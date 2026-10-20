import { useState, type RefObject } from 'react'
import { ArrowUp, ArrowDown, Search, X } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function ArticleSearchBar({ search, inputRef, onSearch, onMove, onClose }: {
  search: { keyword: string; index: number; count: number }
  inputRef: RefObject<HTMLInputElement | null>
  onSearch: (keyword: string) => void
  onMove: (direction: number) => void
  onClose: () => void
}) {
  const [draftState, setDraftState] = useState({ keyword: search.keyword, value: search.keyword })
  const draft = draftState.keyword === search.keyword ? draftState.value : search.keyword

  return (
    <form aria-label="文章内搜索" className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
      onSubmit={event => { event.preventDefault(); onSearch(draft.trim()) }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose() }
        if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault()
      }}>
      <div className="relative min-w-0 basis-48 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input ref={inputRef} aria-label="文章内搜索关键词" placeholder="搜索正文，回车查找"
          value={draft} onChange={event => setDraftState({ keyword: search.keyword, value: event.target.value })} className="h-9 pl-9" />
      </div>
      <output aria-live="polite" aria-label="文章内搜索结果" className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
        {search.count ? search.index + 1 : 0} / {search.count}
      </output>
      <div className="flex items-center gap-0.5">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="上一个搜索结果" title="上一个搜索结果"
          disabled={!search.count} onClick={() => onMove(-1)}><ArrowUp /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="下一个搜索结果" title="下一个搜索结果"
          disabled={!search.count} onClick={() => onMove(1)}><ArrowDown /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="关闭文章内搜索" title="关闭文章内搜索"
          onClick={onClose}><X /></Button>
      </div>
    </form>
  )
}
