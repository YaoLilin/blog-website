import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Article, Category } from '../types'
import { formatDate } from '../lib/utils'
import { formatCategoryPath } from '../lib/category'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const keyword = searchParams.get('q') || ''
  const titleOnly = searchParams.get('titleOnly') === 'true'
  const [results, setResults] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!keyword) return
    setLoading(true)
    api.searchArticles(keyword, titleOnly).then(setResults).catch(() => {}).finally(() => setLoading(false))
  }, [keyword, titleOnly])

  useEffect(() => {
    api.getCategoryTree().then(setCategories).catch(() => {})
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-xl font-semibold mb-6">
        搜索"{keyword}"的结果
        {titleOnly && <span className="text-zinc-400 font-normal text-base ml-2">（仅标题）</span>}
        {results.length > 0 && <span className="text-zinc-400 font-normal text-base ml-2">({results.length} 篇)</span>}
      </h1>
      {loading ? (
        <div className="text-center text-zinc-400 py-12">搜索中...</div>
      ) : results.length === 0 ? (
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
  )
}
