import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithEsbuild } from 'vite'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'

const require = createRequire(import.meta.url)
async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { code } = await transformWithEsbuild(source, path, { jsx: 'automatic' })
  const resolved = code.replace(/from (["'])([^"']+)\1/g, (_, quote, name) =>
    `from ${quote}${imports[name] ?? pathToFileURL(require.resolve(name)).href}${quote}`)
  return `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`
}
const snippetUrl = await moduleUrl('../src/lib/searchSnippet.ts')
const { getSearchSnippet, getArticleSearch, articleSearchUrl, rehypeSearchHighlights } = await import(snippetUrl)
const { SearchResultSnippet } = await import(await moduleUrl('../src/components/SearchResultSnippet.tsx', {
  '../lib/searchSnippet': snippetUrl,
}))
const textOf = parts => parts.map(part => part.text).join('')

test('shows only the first body match context, with Unicode-safe boundaries', () => {
  const parts = getSearchSnippet('😀'.repeat(80) + '流程' + '后'.repeat(100) + '流程第二处', '流程')
  assert.equal(textOf(parts), '…' + '😀'.repeat(60) + '流程' + '后'.repeat(60) + '…')
  assert.deepEqual(parts.filter(part => part.highlighted).map(part => part.text), ['流程'])
})

test('matches literal keywords ignoring case and highlights nearby occurrences', () => {
  const parts = getSearchSnippet('使用 C++，再用 c++，表达式 [a].*', 'C++')
  assert.deepEqual(parts.filter(part => part.highlighted).map(part => part.text), ['C++', 'c++'])
  assert.equal(textOf(getSearchSnippet('表达式 [a].*', '[a].*')), '表达式 [a].*')
})

test('extracts readable Markdown, preserving code and excluding image and link destinations', () => {
  const markdown = '<!-- 流程隐藏 -->\n![流程图片](/流程.png)\n[文档](/流程)\n\n## 正文\n实际**流程**说明与 `code`\n\n```js\nconst 流程 = 1\n```'
  const parts = getSearchSnippet(markdown, '流程')
  assert.equal(textOf(parts), '文档 正文 实际流程说明与 code const 流程 = 1')
  assert.equal(parts.filter(part => part.highlighted).length, 2)
  assert.deepEqual(getSearchSnippet('[参考](/only-url)', 'only-url'), [])
})

test('omits missing matches and empty inputs without substituting title or summary', () => {
  for (const content of ['', null, undefined, '正文没有匹配']) {
    assert.deepEqual(getSearchSnippet(content, '流程'), [])
  }
  assert.deepEqual(getSearchSnippet('正文', '  '), [])
  assert.equal(renderToStaticMarkup(createElement(SearchResultSnippet, { content: '正文', keyword: '标题' })), '')
})

test('renders semantic highlights with escaped text instead of executable HTML', () => {
  const html = renderToStaticMarkup(createElement(SearchResultSnippet, {
    content: '流程 `<img src=x onerror=alert(1)>`', keyword: '流程',
  }))
  assert.match(html, /<mark[^>]*>流程<\/mark>/)
  assert.ok(html.includes('&lt;img'))
  assert.ok(!html.includes('<img'))
})

test('counts each occurrence but merges overlapping contexts without extending the card snippet', () => {
  const search = getArticleSearch('前'.repeat(80) + '流程甲流程' + '间'.repeat(200) + '流程结尾', '流程')
  assert.equal(search.count, 3)
  assert.equal(search.contexts.length, 2)
  assert.deepEqual(search.contexts.map(context => [context.matchIndex, context.matchCount]), [[0, 2], [2, 1]])
  assert.equal(search.contexts[0].parts.filter(part => part.highlighted).length, 2)
  assert.equal(textOf(search.firstSnippet), '…' + '前'.repeat(60) + '流程甲流程' + '间'.repeat(57) + '…')
  assert.ok(textOf(search.contexts[1].parts).endsWith('流程结尾'))
})

test('shares match order with article anchors across formatted text, HTML and highlighted code', () => {
  const content = '流**程**一\n\n<span>流程</span>二\n\n```js\nconst 流程 = "流程"\n```'
  const search = getArticleSearch(content, '流程')
  assert.equal(search.count, 4)
  const html = renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeRaw, rehypeHighlight, [rehypeSearchHighlights, { keyword: '流程', selectedMatch: 3 }]],
    children: content,
  }))
  assert.deepEqual([...html.matchAll(/id="article-search-hit-(\d+)"/g)].map(match => Number(match[1])), [0, 1, 2, 3])
  assert.match(html, /<strong><mark[^>]*data-search-hit="0"[^>]*>程<\/mark><\/strong>/)
  assert.match(html, /data-search-hit="3"[^>]*class="[^"]*ring-2/)
})

test('excludes hidden HTML and script text and keeps literal keywords in shareable links', () => {
  const content = '<div hidden>流程</div><script>流程</script><p>正文流程</p>'
  assert.equal(getArticleSearch(content, '流程').count, 1)
  const url = new URL(articleSearchUrl(10, 'C++ & [流程]#', 2), 'https://example.test')
  assert.equal(url.pathname, '/articles/10')
  assert.equal(url.searchParams.get('highlight'), 'C++ & [流程]#')
  assert.equal(url.searchParams.get('match'), '2')
})
