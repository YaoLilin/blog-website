import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import type { Root, Element, Text, RootContent } from 'hast'

const parser = unified().use(remarkParse).use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw)
const contextLength = 60
const blockTags = new Set(['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'blockquote', 'pre', 'tr', 'td', 'th', 'table', 'ul', 'ol', 'hr', 'br'])

export interface SearchSnippetPart {
  text: string
  highlighted: boolean
}

interface SearchMatch {
  start: number
  end: number
}

export interface SearchContext {
  matchIndex: number
  matchCount: number
  parts: SearchSnippetPart[]
}

interface TextLeaf {
  node: Text
  start: number
  end: number
}

// Both snippets and article anchors use rendered text, including code and inline formatting.
function textIndex(root: Root) {
  const chunks: string[] = []
  const leaves: TextLeaf[] = []
  let length = 0
  const append = (text: string) => { chunks.push(text); length += text.length }
  const visit = (node: Root | RootContent) => {
    if (node.type === 'text') {
      leaves.push({ node, start: length, end: length + node.value.length })
      append(node.value)
    } else if (node.type === 'root' || node.type === 'element') {
      if (node.type === 'element' && (['script', 'style', 'template', 'noscript', 'img'].includes(node.tagName)
        || node.properties.hidden || node.properties.ariaHidden === 'true' || node.properties.dataFootnoteBackref)) return
      const block = node.type === 'element' && blockTags.has(node.tagName)
      if (block) append(' ')
      node.children.forEach(visit)
      if (block) append(' ')
    }
  }
  visit(root)
  const raw = chunks.join('')
  const offsets: number[] = []
  const characters: string[] = []
  for (let i = 0; i < raw.length; i++) {
    const whitespace = /\s/.test(raw[i])
    if (whitespace && (!characters.length || characters[characters.length - 1] === ' ')) continue
    offsets.push(i)
    characters.push(whitespace ? ' ' : raw[i])
  }
  if (characters[characters.length - 1] === ' ') { characters.pop(); offsets.pop() }
  return { text: characters.join(''), offsets, leaves }
}

function matchesIn(text: string, keyword: string): SearchMatch[] {
  if (!keyword.trim()) return []
  const pattern = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  return Array.from(text.matchAll(pattern), match => ({ start: match.index, end: match.index + match[0].length }))
}

function partsIn(text: string, start: number, end: number, matches: SearchMatch[]): SearchSnippetPart[] {
  const parts: SearchSnippetPart[] = []
  if (start > 0) parts.push({ text: '…', highlighted: false })
  let offset = start
  for (const match of matches) {
    if (match.start < start || match.end > end) continue
    if (match.start > offset) parts.push({ text: text.slice(offset, match.start), highlighted: false })
    parts.push({ text: text.slice(match.start, match.end), highlighted: true })
    offset = match.end
  }
  if (offset < end) parts.push({ text: text.slice(offset, end), highlighted: false })
  if (end < text.length) parts.push({ text: '…', highlighted: false })
  return parts
}

export function getArticleSearch(content: string | null | undefined, keyword: string) {
  const empty = { count: 0, firstSnippet: [] as SearchSnippetPart[], contexts: [] as SearchContext[] }
  if (!content || !keyword.trim()) return empty
  // Match ArticlePage's comment removal before parsing.
  const markdown = content.replace(/<!--[\s\S]*?-->/g, '')
  const { text } = textIndex(parser.runSync(parser.parse(markdown)))
  const matches = matchesIn(text, keyword)
  if (!matches.length) return empty

  const boundaries = [0]
  for (const character of text) boundaries.push(boundaries[boundaries.length - 1] + character.length)
  const pointIndex = new Map(boundaries.map((offset, point) => [offset, point]))
  const ranges = matches.map((match, matchIndex) => ({
    start: boundaries[Math.max(0, pointIndex.get(match.start)! - contextLength)],
    end: boundaries[Math.min(boundaries.length - 1, pointIndex.get(match.end)! + contextLength)],
    matchIndex,
    matchCount: 1,
  }))
  const groups: typeof ranges = []
  for (const range of ranges) {
    const previous = groups[groups.length - 1]
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end)
      previous.matchCount++
    } else groups.push({ ...range })
  }
  return {
    count: matches.length,
    firstSnippet: partsIn(text, ranges[0].start, ranges[0].end, matches),
    contexts: groups.map(group => ({
      matchIndex: group.matchIndex,
      matchCount: group.matchCount,
      parts: partsIn(text, group.start, group.end, matches),
    })),
  }
}

export function getSearchSnippet(content: string | null | undefined, keyword: string): SearchSnippetPart[] {
  return getArticleSearch(content, keyword).firstSnippet
}

export function articleSearchUrl(articleId: number, keyword: string, matchIndex = 0): string {
  return `/articles/${articleId}?${new URLSearchParams({ highlight: keyword, match: String(matchIndex) })}`
}

export const searchHighlightClass = 'rounded-sm bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200'

export function rehypeSearchHighlights({ keyword, selectedMatch = 0 }: { keyword: string; selectedMatch?: number }) {
  return (tree: Root) => {
    if (!keyword.trim()) return
    const { text, offsets, leaves } = textIndex(tree)
    const matches = matchesIn(text, keyword).map((match, index) => ({
      start: offsets[match.start], end: offsets[match.end - 1] + 1, index,
    }))
    const activeMatch = matches[selectedMatch] ? selectedMatch : 0
    const replacements = new Map<Text, (Text | Element)[]>()
    const anchored = new Set<number>()
    let cursor = 0
    for (const leaf of leaves) {
      while (cursor < matches.length && matches[cursor].end <= leaf.start) cursor++
      const children: (Text | Element)[] = []
      let offset = 0
      for (let i = cursor; i < matches.length && matches[i].start < leaf.end; i++) {
        const match = matches[i]
        const start = Math.max(0, match.start - leaf.start)
        const end = Math.min(leaf.node.value.length, match.end - leaf.start)
        if (start > offset) children.push({ type: 'text', value: leaf.node.value.slice(offset, start) })
        const first = !anchored.has(match.index)
        anchored.add(match.index)
        children.push({
          type: 'element', tagName: 'mark',
          properties: {
            ...(first ? { id: `article-search-hit-${match.index}`, tabIndex: -1 } : {}),
            dataSearchHit: match.index,
            className: `${searchHighlightClass} ${match.index === activeMatch ? 'ring-2 ring-amber-500/70' : ''}`,
          },
          children: [{ type: 'text', value: leaf.node.value.slice(start, end) }],
        })
        offset = end
      }
      if (children.length) {
        if (offset < leaf.node.value.length) children.push({ type: 'text', value: leaf.node.value.slice(offset) })
        replacements.set(leaf.node, children)
      }
    }
    const apply = (parent: Root | Element) => {
      for (let index = parent.children.length - 1; index >= 0; index--) {
        const node = parent.children[index]
        if (node.type === 'text') {
          const replacement = replacements.get(node)
          if (replacement) parent.children.splice(index, 1, ...replacement)
        } else if (node.type === 'element') apply(node)
      }
    }
    apply(tree)
  }
}
