import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { chromium } from 'playwright'

test('article metadata stays unique across server HTML and client navigation', async () => {
  const dist = resolve('dist')
  const shell = await readFile(resolve(dist, 'index.html'), 'utf8')
  const articles = [152, 153].map(id => ({
    id, title: `测试文章${id}`, content: `## 正文\n文章${id}的正文摘要。`,
    description: `文章${id}的正文摘要。`.repeat(15).slice(0, 160),
    categoryId: 1, viewCount: 0, isRecommended: false, isServerManaged: false,
    createdAt: '2026-10-12T12:00:00', updatedAt: '2026-10-12T12:00:00',
  }))
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname.startsWith('/api/')) {
        const article = articles.find(item => url.pathname === `/api/articles/${item.id}`)
        const data = article ?? (url.pathname === '/api/categories/tree'
          ? [{ id: 1, name: '测试分类', parentId: null, children: [] }]
          : url.pathname === '/api/articles' ? { content: articles }
          : url.pathname === '/api/articles/recent' ? articles : [])
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
      } else if (url.pathname.startsWith('/assets/')) {
        res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css')
        res.end(await readFile(resolve(dist, `.${url.pathname}`)))
      } else {
        // Include legacy shell tags plus SSR metadata to reproduce the original duplicate path.
        const article = articles.find(item => url.pathname === `/articles/${item.id}`)
        const meta = article ? `<meta name="description" content="${article.description}">
          <meta property="og:description" content="${article.description}">` : ''
        res.setHeader('Content-Type', 'text/html')
        res.end(shell.replace('</head>', `${meta}</head>`))
      }
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  let browser
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL })
    const page = await browser.newPage()
    const base = `http://127.0.0.1:${server.address().port}`
    const verify = async article => {
      await page.waitForFunction(description => {
        const tags = document.head.querySelectorAll('meta[name="description"]')
        return tags.length === 1 && tags[0].content === description
      }, article.description)
      for (const key of ['description', 'og:description', 'og:title', 'og:type']) {
        const attribute = key === 'description' ? 'name' : 'property'
        const values = await page.locator(`head meta[${attribute}="${key}"]`).evaluateAll(tags => tags.map(tag => tag.content))
        assert.equal(values.length, 1, key)
        if (key.includes('description')) assert.equal(values[0], article.description)
      }
    }
    await page.goto(`${base}/articles/152`)
    await verify(articles[0])
    // These links use React Router, so no document reload hides stale metadata.
    await page.getByRole('link', { name: '测试分类', exact: true }).click()
    await page.waitForURL(`${base}/categories/1`)
    assert.equal(await page.locator('head meta[property="og:description"]').count(), 0)
    await page.locator('a[href="/articles/153"]').first().click()
    await verify(articles[1])
    await page.goBack()
    await page.waitForURL(`${base}/categories/1`)
    await page.goBack()
    await verify(articles[0])
    // The document-path route must use the same API summary.
    await page.route('**/api/articles/by-path?**', route => route.fulfill({ json: articles[0] }))
    await page.goto(`${base}/articles/view?path=test.md`)
    await verify(articles[0])
  } finally {
    await browser?.close()
    await new Promise(done => server.close(done))
  }
})
