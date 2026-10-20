import { useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Article, Category } from '../types'
import { articleSearchUrl, getArticleSearch } from '../lib/searchSnippet'
import { formatDate } from '../lib/utils'
import { formatCategoryPath } from '../lib/category'
import { SearchSnippetText } from './SearchResultSnippet'
import { Button } from './ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'

export function SearchResultCard({ article, keyword, categories }: {
  article: Article
  keyword: string
  categories: Category[]
}) {
  const search = useMemo(() => getArticleSearch(article.content, keyword), [article.content, keyword])
  const [dialogOpen, setDialogOpen] = useState(false)
  const dialogId = useId()
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const openResults = (event: MouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget
    setDialogOpen(true)
  }

  return (
    <article className="relative rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all">
      <Link to={search.count ? articleSearchUrl(article.id, keyword) : `/articles/${article.id}`} target="_blank" rel="noopener noreferrer" className="block p-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2">
        <h2 className="font-medium mb-1 pr-24">{article.title}</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          {article.category && <span>{formatCategoryPath(categories, article.category.id) || article.category.name}</span>}
          <span>{formatDate(article.createdAt)}</span>
        </div>
        {search.firstSnippet.length > 0 && (
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400 break-words">
            <SearchSnippetText parts={search.firstSnippet} />
          </p>
        )}
      </Link>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button type="button" variant="secondary" size="xs" className="absolute right-4 top-4 cursor-pointer disabled:cursor-default" disabled={!search.count}
            onClick={openResults} aria-haspopup="dialog" aria-expanded={dialogOpen} aria-controls={dialogId}
            aria-label={`${article.title}：正文命中 ${search.count} 次，查看全部上下文`}>
            {search.count} 次命中
          </Button>
        <div className="flex justify-end px-4 pb-4">
          <Button type="button" variant="outline" size="sm" className="cursor-pointer font-normal disabled:cursor-default" disabled={!search.count}
            onClick={openResults} aria-haspopup="dialog" aria-expanded={dialogOpen} aria-controls={dialogId}>
            查看结果
          </Button>
        </div>
        <DialogContent id={dialogId} className="flex max-h-[80dvh] flex-col gap-5 sm:max-w-2xl"
          onCloseAutoFocus={event => { event.preventDefault(); openerRef.current?.focus({ preventScroll: true }) }}>
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="break-words">{article.title}</DialogTitle>
            <DialogDescription>
              “{keyword}” · {search.count} 次命中 · {search.contexts.length} 段上下文
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain -mx-2 px-2" aria-label="文章内搜索上下文">
            <ol className="flex flex-col gap-3 pb-1">
              {search.contexts.map(context => (
                <li key={context.matchIndex}>
                  <DialogClose asChild>
                    <Link to={articleSearchUrl(article.id, keyword, context.matchIndex)}
                      target="_blank" rel="noopener noreferrer"
                      className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2">
                      <span className="mb-2 block text-xs text-muted-foreground">
                        第 {context.matchIndex + 1}{context.matchCount > 1 ? `–${context.matchIndex + context.matchCount}` : ''} 处
                        <span className="float-right">跳转到正文 →</span>
                      </span>
                      <p className="break-words text-sm leading-7"><SearchSnippetText parts={context.parts} /></p>
                    </Link>
                  </DialogClose>
                </li>
              ))}
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  )
}
