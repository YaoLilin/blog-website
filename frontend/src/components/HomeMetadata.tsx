import { useLayoutEffect } from 'react'
import { SITE_CONFIG } from '../config/site'

export function HomeMetadata() {
  useLayoutEffect(() => {
    document.title = SITE_CONFIG.homeTitle
    const tags = [
      ['name', 'author', `${SITE_CONFIG.author}（${SITE_CONFIG.authorAlias}）`],
      ['name', 'description', SITE_CONFIG.description],
      ['property', 'og:title', SITE_CONFIG.homeTitle],
      ['property', 'og:description', SITE_CONFIG.description],
      ['property', 'og:type', 'website'],
      ['property', 'og:url', SITE_CONFIG.homeUrl],
    ].map(([attribute, key, content]) => {
      const matches = [...document.head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${key}"]`)]
      const tag = matches.shift() ?? document.createElement('meta')
      matches.forEach(duplicate => duplicate.remove())
      tag.setAttribute(attribute, key)
      tag.content = content
      if (!tag.isConnected) document.head.appendChild(tag)
      return tag
    })
    const canonicals = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')]
    const canonical = canonicals.shift() ?? document.createElement('link')
    canonicals.forEach(duplicate => duplicate.remove())
    canonical.rel = 'canonical'
    canonical.href = SITE_CONFIG.homeUrl
    if (!canonical.isConnected) document.head.appendChild(canonical)
    return () => {
      tags.filter(tag => tag.name !== 'author').forEach(tag => tag.remove())
      canonical.remove()
    }
  }, [])

  return null
}
