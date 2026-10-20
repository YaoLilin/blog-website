import { useEffect, type RefObject } from 'react'

export function useArticleSearchNavigation({ contentRef, headerRef, ready, keyword, matchIndex, revision = 0 }: {
  contentRef: RefObject<HTMLDivElement | null>
  headerRef: RefObject<HTMLDivElement | null>
  ready: boolean
  keyword: string
  matchIndex: number
  revision?: number
}) {
  useEffect(() => {
    const content = contentRef.current
    if (!ready || !keyword.trim() || !content) return
    const target = content.querySelector<HTMLElement>(`#article-search-hit-${matchIndex}`)
      ?? content.querySelector<HTMLElement>('#article-search-hit-0')
    if (!target) return

    let frame = 0
    let stopped = false
    const scroll = () => {
      if (stopped) return
      // Reveal matches inside horizontally scrollable code blocks, then account for sticky headers.
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
      const top = target.getBoundingClientRect().top + window.scrollY
        - 56 - (headerRef.current?.offsetHeight ?? 96) - 24
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
      // Keep toolbar controls focused so Enter and arrow buttons can be used repeatedly.
      if (!headerRef.current?.contains(document.activeElement)) target.focus({ preventScroll: true })
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(scroll)
    }
    // Lazy-loaded images may move the target. Track layout until the user starts interacting.
    const observer = new ResizeObserver(schedule)
    observer.observe(content)
    if (headerRef.current) observer.observe(headerRef.current)
    const stop = () => {
      stopped = true
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    events.forEach(event => window.addEventListener(event, stop, { passive: true }))
    schedule()
    return () => {
      stop()
      events.forEach(event => window.removeEventListener(event, stop))
    }
  }, [contentRef, headerRef, ready, keyword, matchIndex, revision])
}
