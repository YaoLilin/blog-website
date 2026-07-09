import type { Article } from '../types'

function canonicalServerManagedArticlePath(filePath?: string | null): string {
  if (!filePath) return ''
  const normalized = filePath.replaceAll('\\', '/')
  const docsIndex = normalized.indexOf('/docs/')
  if (docsIndex >= 0) {
    return normalized.slice(docsIndex + '/docs/'.length)
  }
  return normalized
}

function compareArticlePriority(left: Article, right: Article): number {
  const leftPath = left.filePath ?? ''
  const rightPath = right.filePath ?? ''
  const leftScore = leftPath.includes('/server/docs/') ? 0 : 1
  const rightScore = rightPath.includes('/server/docs/') ? 0 : 1
  if (leftScore !== rightScore) {
    return leftScore - rightScore
  }
  return left.id - right.id
}

export function dedupeArticles(items: Article[]): Article[] {
  const unique = new Map<string, Article>()
  for (const article of items) {
    const key = article.isServerManaged && article.filePath
      ? `server:${canonicalServerManagedArticlePath(article.filePath)}`
      : `id:${article.id}`
    const existing = unique.get(key)
    if (!existing || compareArticlePriority(article, existing) < 0) {
      unique.set(key, article)
    }
  }
  return [...unique.values()]
}
