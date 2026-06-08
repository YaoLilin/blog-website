import { Link, useLoaderData } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { api } from '../api'
import type { Article, Category } from '../types'
import { formatDate } from '../lib/utils'
import { formatCategoryPath } from '../lib/category'
import { SITE_CONFIG } from '../config/site'

export interface SearchLoaderData {
  keyword: string
  titleOnly: boolean
  results: Article[]
  categories: Category[]
}

export async function loader({ request }: { request: Request }): Promise<SearchLoaderData> {
  const url = new URL(request.url)
  const keyword = url.searchParams.get('q') || ''
  const titleOnly = url.searchParams.get('titleOnly') === 'true'

  const [results, categories] = await Promise.all([
    keyword ? api.searchArticles(keyword, titleOnly).catch(() => [] as Article[]) : Promise.resolve([] as Article[]),
    api.getCategoryTree().catch(() => [] as Category[]),
  ])
  return { keyword, titleOnly, results, categories }
}

export function SearchPage() {
  const { keyword, titleOnly, results, categories } = useLoaderData() as SearchLoaderData

  return (
    <>
      <Helmet>
        <title>{keyword ? `搜索"${keyword}"` : '搜索'} - {SITE_CONFIG.name}</title>
        <meta name="description" content={`搜索"${keyword}" - ${results.length} 篇相关文章`} />
      </Helmet>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-xl font-semibold mb-6">
        搜索"{keyword}"的结果
        {titleOnly && <span className="text-zinc-400 font-normal text-base ml-2">（仅标题）</span>}
        {results.length > 0 && <span className="text-zinc-400 font-normal text-base ml-2">({results.length} 篇)</span>}
      </h1>
      {results.length === 0 ? (
        <div className="text-center text-zinc-400 py-12">没有找到相关文章</div>
      ) : (
        <div className="space-y-3">
          {results.map(a => (
            <Link
              key={a.id}
              to={`/articles/${a.id}`}
              className="block p-4 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
            >
              <h2 className="font-medium mb-1">{a.title}</h2>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                {a.category && <span>{formatCategoryPath(categories, a.category.id) || a.category.name}</span>}
                <span>{formatDate(a.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  )
}
