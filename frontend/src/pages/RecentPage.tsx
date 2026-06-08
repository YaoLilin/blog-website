import { Calendar } from 'lucide-react'
import { Link, useLoaderData } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { api } from '../api'
import type { Article, Category } from '../types'
import { formatDate } from '../lib/utils'
import { formatCategoryPath } from '../lib/category'
import { SITE_CONFIG } from '../config/site'

export interface RecentLoaderData {
  articles: Article[]
  categories: Category[]
}

export async function loader(): Promise<RecentLoaderData> {
  const [categories, articles] = await Promise.all([
    api.getCategoryTree().catch(() => [] as Category[]),
    api.getRecentArticles(100).catch(() => [] as Article[]),
  ])
  return { categories, articles }
}

export function RecentPage() {
  const { articles, categories } = useLoaderData() as RecentLoaderData

  return (
    <>
      <Helmet>
        <title>最近文章 - {SITE_CONFIG.name}</title>
        <meta name="description" content={`最近发布的文章 - ${SITE_CONFIG.name}`} />
      </Helmet>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">最近文章</h1>
        </div>
        <Link
          to="/"
          className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
        >
          返回首页
        </Link>
      </div>

      <div className="space-y-3">
        {articles.map(article => (
          <Link
            key={article.id}
            to={`/articles/${article.id}`}
            className="flex items-start justify-between p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group"
          >
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                {article.title}
              </h3>
              {article.category && (
                <span className="text-xs text-zinc-500 mt-1 block">
                  {formatCategoryPath(categories, article.category.id) || article.category.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400 shrink-0 ml-4">
              <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(article.createdAt)}</span>
            </div>
          </Link>
        ))}
        {articles.length === 0 && (
          <div className="py-16 text-center text-zinc-400">暂无最近文章</div>
        )}
      </div>
    </div>
    </>
  )
}
