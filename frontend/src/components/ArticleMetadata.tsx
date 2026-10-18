import { useLayoutEffect } from 'react'
import { SITE_CONFIG } from '../config/site'
import type { Article } from '../types'

export function ArticleMetadata({ article }: { article: Article }) {
  useLayoutEffect(() => {
    const title = `${article.seoTitle} - ${SITE_CONFIG.name}`
    const titles = [...document.head.querySelectorAll('title')]
    const titleTag = titles.shift() ?? document.createElement('title')
    titles.forEach(duplicate => duplicate.remove())
    titleTag.textContent = title
    if (!titleTag.isConnected) document.head.appendChild(titleTag)
    // React 19 的 meta 会提升到 head，但不会与服务端标签去重。
    const values = [
      ['name', 'description', article.description],
      ['property', 'og:description', article.description],
      ['property', 'og:title', title],
      ['property', 'og:type', 'article'],
    ] as const
    const tags = values.map(([attribute, key, content]) => {
      const matches = [...document.head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${key}"]`)]
      const tag = matches.shift() ?? document.createElement('meta')
      matches.forEach(duplicate => duplicate.remove())
      tag.setAttribute(attribute, key)
      tag.content = content
      if (!tag.isConnected) document.head.appendChild(tag)
      return tag
    })
    return () => tags.forEach(tag => tag.remove())
  }, [article.description, article.seoTitle])

  return null
}
