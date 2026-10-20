import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { chromium } from 'playwright'

test('search counts, merged dialog contexts and article navigation work together', async () => {
  const dist = resolve('dist')
  const shell = await readFile(resolve(dist, 'index.html'), 'utf8')
  const article = {
    id: 901, title: '流程定位验证文章', categoryId: 1,
    content: Array(20).fill('开篇说明。'.repeat(30)).join('\n\n') + '\n\n流**程**首次定位，附近另一个流程。\n\n'
      + Array.from({ length: 12 }, (_, index) => `## 小节${index}\n\n${'说明'.repeat(100)}\n\n`
        + (index === 5 ? '```js\nconst 流程 = "流程"\n```\n\n' : `流程第${index + 1}段。\n\n`)
        + '后续说明。'.repeat(30)).join('\n\n') + '\n\n' + Array(10).fill('结尾说明。'.repeat(30)).join('\n\n'),
    viewCount: 0, isRecommended: false, isServerManaged: false,
    createdAt: '2026-10-20T12:00:00', updatedAt: '2026-10-20T12:00:00',
  }
  const titleOnly = { ...article, id: 902, title: '流程只在标题中', content: '正文没有查询词。' }
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost')
      if (url.pathname.startsWith('/api/')) {
        const data = url.pathname === '/api/articles/search' ? [article, titleOnly]
          : ['/api/articles/901', '/api/articles/by-path'].includes(url.pathname) ? article
          : url.pathname === '/api/categories/tree' ? [{ id: 1, name: '测试分类', children: [] }] : []
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(data))
      } else if (url.pathname.startsWith('/assets/')) {
        response.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css')
        response.end(await readFile(resolve(dist, `.${url.pathname}`)))
      } else {
        response.setHeader('Content-Type', 'text/html')
        response.end(shell)
      }
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  let browser
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL })
    let page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const searchPage = page
    const base = `http://127.0.0.1:${server.address().port}`
    const searchUrl = `${base}/search?q=${encodeURIComponent('流程')}`
    const openArticle = async link => {
      const popupPromise = searchPage.waitForEvent('popup')
      await link.click()
      page = await popupPromise
      await page.waitForLoadState()
      assert.equal(searchPage.url(), searchUrl, '原搜索结果页保留')
      assert.equal(await page.evaluate(() => window.opener), null)
    }
    const verifyPosition = async (index, focus = true) => {
      await page.waitForFunction(index => {
        const target = document.getElementById(`article-search-hit-${index}`)
        const header = document.querySelector('main .sticky.backdrop-blur')
        return target?.classList.contains('ring-2') && target.getBoundingClientRect().top >= header.getBoundingClientRect().bottom
          && target.getBoundingClientRect().top < innerHeight
      }, index)
      if (focus) await page.waitForFunction(index => document.activeElement?.id === `article-search-hit-${index}`, index)
      const position = await page.evaluate(index => {
        const target = document.getElementById(`article-search-hit-${index}`)
        const header = document.querySelector('main .sticky.backdrop-blur')
        return { top: target.getBoundingClientRect().top, bottom: header.getBoundingClientRect().bottom, height: innerHeight, scroll: scrollY }
      }, index)
      assert.ok(position.scroll > 0, JSON.stringify(position))
      assert.ok(position.top >= position.bottom && position.top < position.height, JSON.stringify(position))
    }
    await page.goto(searchUrl)
    const cards = page.locator('article')
    const hitCount = cards.first().getByRole('button', { name: /正文命中 15 次/ })
    await hitCount.hover()
    assert.equal(await hitCount.evaluate(element => getComputedStyle(element).cursor), 'pointer')
    await cards.first().getByRole('button', { name: /正文命中 15 次/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    assert.equal(page.url(), searchUrl, '点击数量只打开对话框')
    assert.ok((await dialog.textContent()).includes('15 次命中 · 13 段上下文'))
    assert.equal(await dialog.getByRole('link').count(), 13)
    assert.equal(await dialog.getByRole('link').first().locator('mark').count(), 2)
    assert.ok(await dialog.getByLabel('文章内搜索上下文').evaluate(element => element.scrollHeight > element.clientHeight))
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await cards.last().getByRole('button', { name: /正文命中/ }).isDisabled(), true)
    assert.equal(await cards.last().getByRole('button', { name: '查看结果', exact: true }).isDisabled(), true)

    await cards.first().getByRole('button', { name: '查看结果', exact: true }).click()
    const codeResult = dialog.getByRole('link').filter({ hasText: 'const' })
    const codeDestination = new URL(await codeResult.getAttribute('href'), base)
    const codeIndex = Number(codeDestination.searchParams.get('match'))
    await openArticle(codeResult)
    await verifyPosition(codeIndex)
    assert.equal(await page.locator(`pre #article-search-hit-${codeIndex}`).count(), 1)
    await page.close()
    page = searchPage
    await cards.first().getByRole('button', { name: '查看结果', exact: true }).click()
    const lastResult = dialog.getByRole('link').last()
    const destination = new URL(await lastResult.getAttribute('href'), base)
    const matchIndex = Number(destination.searchParams.get('match'))
    await openArticle(lastResult)
    await page.waitForURL(destination.href)
    await verifyPosition(matchIndex)
    assert.equal(await page.locator('mark[id^="article-search-hit-"]').count(), 15)
    await page.reload()
    await verifyPosition(matchIndex)

    await page.close()
    page = searchPage
    await openArticle(cards.first().getByRole('link'))
    await page.waitForURL(/highlight=.*&match=0/)
    await verifyPosition(0)
    assert.equal((await page.locator('[data-search-hit="0"]').allTextContents()).join(''), '流程')

    const input = page.getByRole('textbox', { name: '文章内搜索关键词' })
    const counter = page.getByLabel('文章内搜索结果')
    assert.equal(await input.inputValue(), '流程')
    assert.equal((await counter.textContent()).trim(), '1 / 15')
    await page.screenshot({ path: '/tmp/myblog-article-search.png', animations: 'disabled' })
    let articleReads = 0
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/articles/901') articleReads++ })
    await page.getByRole('button', { name: '下一个搜索结果', exact: true }).click()
    await verifyPosition(1, false)
    assert.equal((await counter.textContent()).trim(), '2 / 15')
    await page.getByRole('button', { name: '上一个搜索结果', exact: true }).click()
    await verifyPosition(0, false)
    await page.getByRole('button', { name: '上一个搜索结果', exact: true }).click()
    await verifyPosition(14, false)
    assert.equal((await counter.textContent()).trim(), '15 / 15')
    await page.getByRole('button', { name: '下一个搜索结果', exact: true }).click()
    await verifyPosition(0, false)
    await input.fill('const')
    assert.equal((await counter.textContent()).trim(), '1 / 15', '编辑过程中不执行搜索')
    await input.press('Enter')
    await page.waitForURL(/highlight=const&match=0/)
    await verifyPosition(0, false)
    assert.equal(await input.inputValue(), 'const')
    assert.equal((await counter.textContent()).trim(), '1 / 1')
    assert.equal(await input.evaluate(element => element === document.activeElement), true)
    // Repeating the same search must still locate the hit after manual scrolling.
    await page.evaluate(() => window.scrollTo(0, 0))
    await input.press('Enter')
    await verifyPosition(0, false)
    await page.getByRole('button', { name: '关闭文章内搜索', exact: true }).click()
    assert.equal(await page.locator('mark[data-search-hit]').count(), 0, '关闭搜索框移除搜索高亮')
    await page.getByRole('button', { name: '打开文章内搜索', exact: true }).click()
    assert.equal(await input.inputValue(), 'const')
    await verifyPosition(0, false)
    assert.equal(await page.locator('mark[id^="article-search-hit-"]').count(), 1, '重新打开恢复高亮')
    await input.press('Escape')
    assert.equal(await page.locator('mark[data-search-hit]').count(), 0, 'Escape 关闭同样移除搜索高亮')
    await page.getByRole('button', { name: '打开文章内搜索', exact: true }).click()
    await input.fill('不存在的查询词')
    await input.press('Enter')
    await page.waitForFunction(() => document.querySelector('[aria-label="文章内搜索结果"]').textContent.trim() === '0 / 0')
    assert.equal(await page.getByRole('button', { name: '下一个搜索结果', exact: true }).isDisabled(), true)
    assert.equal(await page.locator('mark[id^="article-search-hit-"]').count(), 0)
    await page.getByRole('button', { name: '关闭文章内搜索', exact: true }).click()
    assert.equal(await input.count(), 0)
    await page.getByRole('button', { name: '打开文章内搜索', exact: true }).click()
    assert.equal(await input.inputValue(), '不存在的查询词')
    await input.fill('')
    await input.press('Enter')
    await page.waitForURL(`${base}/articles/901`)
    assert.equal(await input.count(), 1, '清空关键词后仍保留搜索框')
    await input.press('Escape')
    assert.equal(await input.count(), 0)
    assert.equal(articleReads, 0, '文章内搜索不重新请求正文')

    // Invalid ordinals fall back to the first hit; missing keywords leave the article unmarked.
    await page.goto(`${base}/articles/901?highlight=${encodeURIComponent('流程')}&match=999`)
    await verifyPosition(0)
    await page.goto(`${base}/articles/901?highlight=absent&match=0`)
    await page.getByRole('heading', { name: article.title, exact: true }).waitFor()
    assert.equal(await page.locator('mark[id^="article-search-hit-"]').count(), 0)

    await page.goto(`${base}/articles/view?path=test.md`)
    await page.getByRole('button', { name: '打开文章内搜索', exact: true }).click()
    await input.fill('流程')
    await input.press('Enter')
    await page.waitForURL(url => url.searchParams.get('path') === 'test.md' && url.searchParams.get('highlight') === '流程')
    await verifyPosition(0, false)

    await page.close()
    page = searchPage
    const pageCardText = await cards.first().textContent()
    await page.setViewportSize({ width: 1280, height: 500 })
    await page.keyboard.press('ControlOrMeta+k')
    const articleSearchDialog = page.getByRole('dialog', { name: '搜索文章', exact: true })
    await articleSearchDialog.getByRole('textbox').fill('流程')
    await articleSearchDialog.getByRole('button', { name: '搜索', exact: true }).click()
    const dialogCards = articleSearchDialog.locator('article')
    await dialogCards.first().getByRole('button', { name: /正文命中 15 次/ }).waitFor()
    assert.equal(await dialogCards.first().textContent(), pageCardText, '对话框与搜索页显示同一结果卡片')
    assert.ok(await articleSearchDialog.getByLabel('搜索文章结果列表').evaluate(element => element.scrollHeight > element.clientHeight))
    await articleSearchDialog.getByRole('textbox').fill('暂未提交的新词')
    assert.equal(await dialogCards.first().textContent(), pageCardText, '输入草稿不改变已提交结果')
    await dialogCards.first().getByRole('button', { name: '查看结果', exact: true }).click()
    const nestedDialog = page.getByRole('dialog', { name: article.title, exact: true })
    await nestedDialog.waitFor()
    assert.equal(await nestedDialog.getByRole('link').count(), 13)
    await page.keyboard.press('Escape')
    await nestedDialog.waitFor({ state: 'hidden' })
    await articleSearchDialog.waitFor()
    await dialogCards.first().getByRole('button', { name: /正文命中 15 次/ }).click()
    await nestedDialog.waitFor()
    const nestedResult = nestedDialog.getByRole('link').last()
    const nestedIndex = Number(new URL(await nestedResult.getAttribute('href'), base).searchParams.get('match'))
    await openArticle(nestedResult)
    await verifyPosition(nestedIndex)
    await page.close()
    page = searchPage
    await articleSearchDialog.waitFor()
    assert.equal(await dialogCards.count(), 2, '新标签页跳转保留原搜索对话框')
    await page.keyboard.press('Escape')
    await articleSearchDialog.waitFor({ state: 'hidden' })
    await page.setViewportSize({ width: 390, height: 844 })
    await cards.first().getByRole('button', { name: '查看结果', exact: true }).click()
    await dialog.waitFor()
    await dialog.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390)
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844)
    await page.screenshot({ path: '/tmp/myblog-search-dialog-mobile.png', animations: 'disabled' })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.screenshot({ path: '/tmp/myblog-search-dialog-dark.png', animations: 'disabled' })
  } finally {
    await browser?.close()
    await new Promise(done => server.close(done))
  }
})
