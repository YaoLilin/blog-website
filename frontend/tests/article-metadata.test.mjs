import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { transformWithEsbuild } from 'vite'

test('article metadata stays unique across server HTML and client navigation', async () => {
  const dist = resolve('dist')
  const shell = await readFile(resolve(dist, 'index.html'), 'utf8')
  const siteSource = await readFile(resolve('src/config/site.ts'), 'utf8')
  const transformed = await transformWithEsbuild(siteSource, 'site.ts')
  const { SITE_CONFIG } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`)
  assert.ok(!shell.includes('%SITE_'), '构建产物不能残留站点配置占位符')
  assert.ok(shell.includes(`<title>${SITE_CONFIG.homeTitle}</title>`))
  assert.ok(shell.includes(`name="author" content="${SITE_CONFIG.author}（${SITE_CONFIG.authorAlias}）"`))
  assert.ok(shell.includes(`name="description" content="${SITE_CONFIG.description}"`))
  const articles = [152, 153].map(id => ({
    id, title: `测试文章${id}`, seoTitle: `测试分类 > 测试文章${id}`,
    content: `## 开发环境\n文章${id}的正文摘要。\n![](/empty.png)\n![已有说明](/named.png)`,
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
        const homeMeta = url.pathname === '/' ? '<link rel="canonical" href="https://old.example/">'
          + '<link rel="canonical" href="https://yaolilin.com/">' : ''
        res.end(shell.replace('</head>', `${meta}${homeMeta}</head>`))
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
      const titles = await page.locator('head title').allTextContents()
      assert.equal(titles.length, 1, '文章页只能有一个 title')
      assert.equal(titles[0], `${article.seoTitle} - ${SITE_CONFIG.name}`)
      assert.equal(await page.locator('img[src="/empty.png"]').getAttribute('alt'), '开发环境配图')
      assert.equal(await page.locator('img[src="/named.png"]').getAttribute('alt'), '已有说明')
      for (const key of ['description', 'og:description', 'og:title', 'og:type']) {
        const attribute = key === 'description' ? 'name' : 'property'
        const values = await page.locator(`head meta[${attribute}="${key}"]`).evaluateAll(tags => tags.map(tag => tag.content))
        assert.equal(values.length, 1, key)
        if (key.includes('description')) assert.equal(values[0], article.description)
      }
    }
    await page.goto(base)
    await page.waitForFunction(title => document.title === title, SITE_CONFIG.homeTitle)
    assert.equal(await page.locator('head title').count(), 1)
    assert.equal(await page.locator('head meta[name="description"]').count(), 1)
    assert.equal(await page.locator('head link[rel="canonical"]').count(), 1)
    assert.equal(await page.locator('head link[rel="canonical"]').getAttribute('href'), SITE_CONFIG.homeUrl)
    const introduction = page.locator('#site-introduction')
    assert.equal(await introduction.count(), 1)
    assert.equal(await introduction.isVisible(), false)
    assert.equal(await introduction.locator('h1').textContent(), SITE_CONFIG.homeHeading)
    assert.equal(await introduction.locator('p').textContent(), SITE_CONFIG.introduction)
    await page.locator('a[href="/articles/152"]').first().click()
    await page.waitForURL(`${base}/articles/152`)
    await verify(articles[0])
    assert.equal(await page.locator('head meta[name="author"]').count(), 1)
    assert.equal(await page.locator('head meta[name="author"]').getAttribute('content'), `${SITE_CONFIG.author}（${SITE_CONFIG.authorAlias}）`)
    assert.equal(await page.locator('head link[rel="canonical"][href="https://yaolilin.com/"]').count(), 0)
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
