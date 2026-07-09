import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate, useLoaderData } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Folder, FolderOpen, ChevronRight, FileText, Grid, List, Calendar } from 'lucide-react'
import { api } from '../api'
import type { Article, Category } from '../types'
import { Button } from '../components/ui/button'
import { formatDate } from '../lib/utils'
import { formatCategoryPath } from '../lib/category'
import { dedupeArticles } from '../lib/articles'
import { CategoryCover } from '../components/CategoryCover'
import { SITE_CONFIG } from '../config/site'

export interface CategoryLoaderData {
  allCategories: Category[]
  currentCategory: Category | null
  breadcrumb: Category[]
  subCategories: Category[]
  articles: Article[]
  recentArticles: Article[]
}

export async function loader({ params }: { params: { id?: string } }): Promise<CategoryLoaderData> {
  const catId = params.id ? Number(params.id) : null

  const [allCategories, recentArticles] = await Promise.all([
    api.getCategoryTree().catch(() => [] as Category[]),
    api.getRecentArticles(10).catch(() => [] as Article[]),
  ])

  if (!catId) {
    return {
      allCategories,
      currentCategory: null,
      breadcrumb: [],
      subCategories: allCategories,
      articles: [],
      recentArticles,
    }
  }

  const findCatAndPath = (cats: Category[], targetId: number, path: Category[] = []): [Category | null, Category[]] => {
    for (const cat of cats) {
      if (cat.id === targetId) return [cat, [...path, cat]]
      if (cat.children) {
        const [found, p] = findCatAndPath(cat.children, targetId, [...path, cat])
        if (found) return [found, p]
      }
    }
    return [null, []]
  }

  const [cat, path] = findCatAndPath(allCategories, catId)
  const r = await api.getArticles({ categoryId: catId }).catch(() => ({ content: [] as Article[] }))

  return {
    allCategories,
    currentCategory: cat,
    breadcrumb: path,
    subCategories: cat?.children || [],
    articles: dedupeArticles(r.content || []),
    recentArticles,
  }
}

export function CategoryPage() {
  const initial = useLoaderData() as CategoryLoaderData
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState<'icon' | 'tree'>(() => {
    return (localStorage.getItem('categoryViewMode') as 'icon' | 'tree') || 'icon'
  })

  const [allCategories, setAllCategories] = useState<Category[]>(initial.allCategories)
  const [currentCategory, setCurrentCategory] = useState<Category | null>(initial.currentCategory)
  const [breadcrumb, setBreadcrumb] = useState<Category[]>(initial.breadcrumb)
  const [subCategories, setSubCategories] = useState<Category[]>(initial.subCategories)
  const [articles, setArticles] = useState<Article[]>(initial.articles)
  const [recentArticles] = useState<Article[]>(initial.recentArticles)

  useEffect(() => {
    setAllCategories(initial.allCategories)
    setCurrentCategory(initial.currentCategory)
    setBreadcrumb(initial.breadcrumb)
    setSubCategories(initial.subCategories)
    setArticles(initial.articles)
  }, [id, initial])

  useEffect(() => {
    localStorage.setItem('categoryViewMode', viewMode)
  }, [viewMode])

  return (
    <>
      <Helmet>
        <title>{currentCategory ? `${currentCategory.name} - 文章分类` : '文章分类'} - {SITE_CONFIG.name}</title>
        <meta name="description" content={`${currentCategory ? currentCategory.name : '全部'}文章分类 - ${SITE_CONFIG.name}`} />
      </Helmet>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-zinc-100">文章分类</h1>
      {/* 切换按钮 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant={viewMode === 'icon' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('icon')}>
            <Grid size={14} className="mr-1" />图标
          </Button>
          <Button variant={viewMode === 'tree' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('tree')}>
            <List size={14} className="mr-1" />树形
          </Button>
        </div>
      </div>

      {viewMode === 'icon' ? (
        <IconView
          breadcrumb={breadcrumb}
          subCategories={subCategories}
          articles={articles}
          currentCategory={currentCategory}
          onNavigate={navigate}
        />
      ) : (
        <TreeView categories={allCategories} />
      )}

      {/* 最近文章 */}
      {recentArticles.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">最近文章</h2>
          <div className="space-y-3">
            {recentArticles.slice(0, 10).map(article => (
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
                      {formatCategoryPath(allCategories, article.category.id) || article.category.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400 shrink-0 ml-4">
                  <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(article.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              to="/recent"
              className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
            >
              更多最近文章
            </Link>
          </div>
        </section>
      )}
    </div>
    </>
  )
}

function Breadcrumb({ breadcrumb, onNavigate }: { breadcrumb: Category[]; onNavigate: (path: string) => void }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 mb-6 flex-wrap">
      <button onClick={() => onNavigate('/categories')} className="hover:text-zinc-900 dark:hover:text-zinc-100">
        全部分类
      </button>
      {breadcrumb.map((cat, i) => (
        <span key={cat.id} className="flex items-center gap-1">
          <ChevronRight size={14} />
          {i < breadcrumb.length - 1 ? (
            <button onClick={() => onNavigate(`/categories/${cat.id}`)} className="hover:text-zinc-900 dark:hover:text-zinc-100">
              {cat.name}
            </button>
          ) : (
            <span className="text-zinc-900 dark:text-zinc-100">{cat.name}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

function IconView({ breadcrumb, subCategories, articles, currentCategory, onNavigate }: {
  breadcrumb: Category[]; subCategories: Category[]; articles: Article[]; currentCategory: Category | null; onNavigate: (p: string) => void
}) {
  return (
    <div>
      <Breadcrumb breadcrumb={breadcrumb} onNavigate={onNavigate} />

      {subCategories.length > 0 && (
        <section className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {subCategories.map(cat => (
              <Link
                key={cat.id}
                to={`/categories/${cat.id}`}
                className="group relative flex h-40 overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              >
                <CategoryCover
                  coverImage={cat.coverImage}
                  alt={cat.name}
                  className="absolute inset-0"
                  iconClassName="h-12 w-12"
                />
                <span className="absolute bottom-3 right-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {articles.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
            {currentCategory ? `"${currentCategory.name}"` : '全部'}文章（{articles.length}）
          </h2>
          <div className="space-y-2">
            {articles.map(a => (
              <Link
                key={a.id}
                to={`/articles/${a.id}`}
                className="flex items-center justify-between p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
              >
                <span className="text-sm flex items-center gap-2"><FileText size={14} className="text-zinc-400" />{a.title}</span>
                <span className="text-xs text-zinc-400">{formatDate(a.createdAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {subCategories.length === 0 && articles.length === 0 && (
        <div className="text-center py-12 text-zinc-400">暂无内容</div>
      )}
    </div>
  )
}

function TreeNode({ category, depth = 0 }: { category: Category; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const [articles, setArticles] = useState<Article[]>([])
  const hasChildren = category.children && category.children.length > 0

  useEffect(() => {
    if (articles.length === 0) {
      api.getArticles({ categoryId: category.id }).then(r => setArticles(dedupeArticles(r.content || []))).catch(() => {})
    }
  }, [])

  const handleExpand = () => {
    const next = !expanded
    setExpanded(next)
    if (next && articles.length === 0) {
      api.getArticles({ categoryId: category.id }).then(r => setArticles(dedupeArticles(r.content || []))).catch(() => {})
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onClick={handleExpand}
      >
        {expanded && (hasChildren || articles.length > 0) ? (
          <FolderOpen size={16} className="text-amber-500 shrink-0" />
        ) : hasChildren ? (
          <Folder size={16} className="text-amber-500 shrink-0" />
        ) : articles.length > 0 ? (
          <Folder size={16} className="text-amber-500 shrink-0" />
        ) : (
          <Folder size={16} className="text-zinc-400 shrink-0" />
        )}
        <Link to={`/categories/${category.id}`} onClick={e => e.stopPropagation()} className="hover:text-blue-600 dark:hover:text-blue-400">
          {category.name}
        </Link>
        {hasChildren && (
          <ChevronRight size={14} className={`ml-auto text-zinc-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        )}
      </div>

      {expanded && (
        <div>
          {hasChildren && category.children!.map(child => (
            <TreeNode key={child.id} category={child} depth={depth + 1} />
          ))}
          {articles.map(a => (
            <Link
              key={a.id}
              to={`/articles/${a.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
              style={{ paddingLeft: `${8 + (depth + 1) * 20}px` }}
            >
              <FileText size={14} className="text-zinc-400 shrink-0" />
              {a.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function TreeView({ categories }: { categories: Category[] }) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-2">
      {categories.map(cat => <TreeNode key={cat.id} category={cat} />)}
      {categories.length === 0 && <div className="text-center py-8 text-zinc-400">暂无分类</div>}
    </div>
  )
}
