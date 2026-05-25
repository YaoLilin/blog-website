import { useEffect, useState, useMemo } from 'react'
import { Link, useLoaderData } from 'react-router-dom'
import { Calendar, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api'
import type { Article, Category, Project } from '../types'
import { formatDate } from '../lib/utils'
import { findCategoryPath, formatCategoryPath } from '../lib/category'
import { CategoryCover } from '../components/CategoryCover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import bgImage from '../assets/bg.jpg'
import shipImage from '../assets/ship.jpeg'

export interface HomeLoaderData {
  allCategories: Category[]
  recommendedCategories: Category[]
  recommendedArticles: Article[]
  recentArticles: Article[]
  projects: Project[]
  profile: { image: string; content: string; motto: string }
}

export async function loader(): Promise<HomeLoaderData> {
  const [allCategories, recommendedCategories, recommendedArticles, recentArticles, projects, profile] = await Promise.all([
    api.getCategoryTree().catch(() => [] as Category[]),
    api.getHomeCategories().catch(() => [] as Category[]),
    api.getRecommendedArticles().catch(() => [] as Article[]),
    api.getRecentArticles(10).catch(() => [] as Article[]),
    api.getProjects().catch(() => [] as Project[]),
    api.getProfile().catch(() => ({ image: '', content: '', motto: '我们得为人类做点什么' })),
  ])
  return { allCategories, recommendedCategories, recommendedArticles, recentArticles, projects, profile }
}

export function WelcomePage() {
  const { allCategories, recommendedCategories, recommendedArticles, recentArticles, projects, profile } = useLoaderData() as HomeLoaderData
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const NAVBAR_H = 56

  useEffect(() => {
    const flagP = sessionStorage.getItem('scrollToProjects')
    const flagA = sessionStorage.getItem('scrollToAbout')
    if (flagP !== '1' && flagA !== '1') return

    const targetId = flagP === '1' ? 'projects' : 'about'
    sessionStorage.removeItem(flagP === '1' ? 'scrollToProjects' : 'scrollToAbout')

    let retries = 0
    const MAX_RETRIES = 15

    const scrollToTarget = () => {
      const el = document.getElementById(targetId)
      if (!el) {
        if (retries < MAX_RETRIES) {
          retries++
          requestAnimationFrame(scrollToTarget)
        }
        return
      }

      const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_H
      window.scrollTo({ top, behavior: 'instant' })

      setTimeout(() => {
        const el2 = document.getElementById(targetId)
        if (!el2) return
        const actualTop = el2.getBoundingClientRect().top
        if (Math.abs(actualTop - NAVBAR_H) > 3 && retries < MAX_RETRIES) {
          retries++
          requestAnimationFrame(scrollToTarget)
        }
      }, 100)
    }

    requestAnimationFrame(() => requestAnimationFrame(scrollToTarget))
  }, [])

  const getRootCategory = (tree: Category[], categoryId?: number | null): Category | null => {
    if (categoryId == null) return null
    const path = findCategoryPath(tree, categoryId)
    return path.length > 0 ? path[0] : null
  }

  const groupedArticles = useMemo(() => {
    const groups = new Map<number, { category: Category; articles: Article[] }>()
    const uncategorized: Article[] = []
    for (const article of recommendedArticles) {
      const rootCat = article.category ? getRootCategory(allCategories, article.category.id) : null
      if (rootCat) {
        if (!groups.has(rootCat.id)) {
          groups.set(rootCat.id, { category: rootCat, articles: [] })
        }
        groups.get(rootCat.id)!.articles.push(article)
      } else {
        uncategorized.push(article)
      }
    }
    return { groups: Array.from(groups.values()), uncategorized }
  }, [recommendedArticles, allCategories])

  return (
    <div>
      <div className="w-full h-[66.67vh] overflow-hidden pointer-events-none">
        <img src={bgImage} alt="" className="w-full h-full object-cover" />
      </div>

      <div className="container mx-auto px-3 max-w-5xl mb-12 mt-10">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between px-5 py-5 md:px-7 md:py-7">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">泛微开发知识</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                泛微是国内领先的OA厂商，这是我工作的几年中汇总的泛微开发知识
              </p>
              <Link
                to="/articles/74"
                className="mt-5 inline-flex items-center rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
              >
                立即阅读
              </Link>
            </div>
            <div className="ml-6 shrink-0">
              <img
                src="/api/static/images/2026/05/b6368b4c-c61b-4d19-9f12-9310baec82cf.png"
                alt="泛微"
                className="h-32 w-32 object-contain md:h-36 md:w-36"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="container mx-auto px-3 max-w-5xl">
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">文章分类</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recommendedCategories.map(cat => (
              <Link
                key={cat.id}
                to={`/categories/${cat.id}`}
                className="group relative h-40 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <CategoryCover
                  coverImage={cat.coverImage}
                  alt={cat.name}
                  className="absolute inset-0"
                  iconClassName="h-14 w-14"
                />
                <span className="absolute bottom-3 right-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex justify-start">
            <Link
              to="/categories"
              className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
            >
              查看全部分类
            </Link>
          </div>
        </section>

      {/* 推荐文章 - 按最上级分类分组，卡片横向排列 */}
      {recommendedArticles.length > 0 && (
        <section className="mb-12 -mx-3 md:-mx-4 lg:-mx-6">
          <div className="max-w-6xl mx-auto px-3 md:px-4 lg:px-6">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">推荐文章</h2>
            <div className="flex flex-wrap gap-6">
            {groupedArticles.groups.map(({ category, articles }) => (
              <div key={category.id} className="w-[400px] shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden transition-all hover:border-blue-400/40 hover:shadow-[0_0_14px_rgba(96,165,250,0.12)]">
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{category.name}</h3>
                  <span className="text-xs text-zinc-400">{articles.length} 篇</span>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {articles.map(article => (
                    <ArticleItem key={article.id} article={article} categories={allCategories} />
                  ))}
                </div>
              </div>
            ))}
            {groupedArticles.uncategorized.length > 0 && (
              <div className="w-[400px] shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden transition-all hover:border-blue-400/40 hover:shadow-[0_0_14px_rgba(96,165,250,0.12)]">
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">未分类</h3>
                  <span className="text-xs text-zinc-400">{groupedArticles.uncategorized.length} 篇</span>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {groupedArticles.uncategorized.map(article => (
                    <ArticleItem key={article.id} article={article} categories={allCategories} />
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </section>
      )}

      {/* 最近文章 */}
      {recentArticles.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">最近文章</h2>
          <div className="space-y-3">
            {recentArticles.slice(0, 10).map(article => (
              <Link
                key={article.id}
                to={`/articles/${article.id}`}
                className="flex items-start justify-between p-4 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group"
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

      {/* 我的项目 */}
      <div id="projects" className="scroll-mt-16">
        {projects.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">我的项目</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className="group text-left w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="aspect-[3/2] bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                    {p.coverImage ? (
                      <img src={p.coverImage} alt={p.name} className="w-full h-full object-contain p-6" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full">
                        <span className="text-3xl font-bold text-zinc-300 dark:text-zinc-700">{p.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="px-5 py-4">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{p.name}</h3>
                    {p.shortDesc && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{p.shortDesc}</p>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 关于我 */}
      <div id="about" className="scroll-mt-16 mt-12 mb-[50px]">
        <section>
          <h2 className="text-lg font-semibold mb-[60px] text-zinc-900 dark:text-zinc-100">关于我</h2>
          <div className="flex flex-col sm:flex-row gap-8">
            {profile.image && (
              <div className="w-full sm:w-1/2 flex items-start justify-center">
                  <img
                    src={profile.image}
                    alt="个人图片"
                    className="max-h-[400px] max-w-full rounded-xl object-contain [clip-path:inset(0_round_0.75rem)]"
                  />
              </div>
            )}
            <div className="w-full sm:w-1/2">
              {profile.motto && (
                <p className="text-sm italic text-zinc-500 dark:text-zinc-400 mb-3">&ldquo;{profile.motto}&rdquo;</p>
              )}
              {profile.content ? (
                <div className="prose dark:prose-invert prose-sm max-w-none text-zinc-700 dark:text-zinc-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {profile.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-zinc-700 dark:text-zinc-300">你好，我是姚礼林。</p>
              )}
            </div>
          </div>
        </section>
      </div>
      </div>

      <div className="w-full mt-[100px] overflow-hidden pointer-events-none">
        <img src={shipImage} alt="" className="w-full h-auto object-contain" />
      </div>

      {/* 项目详情弹窗 */}
      <Dialog open={!!selectedProject} onOpenChange={(open) => { if (!open) setSelectedProject(null) }}>
        <DialogContent className="sm:max-w-lg">
          {selectedProject && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedProject.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedProject.coverImage && (
                  <div className="rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-6">
                    <img src={selectedProject.coverImage} alt={selectedProject.name} className="max-h-40 object-contain" />
                  </div>
                )}
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                  {selectedProject.description || selectedProject.shortDesc || '暂无描述'}
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <a
                  href={selectedProject.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <ExternalLink size={16} />
                  查看项目
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 开源项目 */}
      <div className="bg-black text-white py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-base mb-1">你喜欢这个网站吗？</p>
          <p className="text-base mb-8">此网站是开源的，点击下方查看开源项目</p>
          <a
            href="https://github.com/yaolilin"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 transition-colors text-sm"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 .5C5.73.5.75 5.67.75 12.05c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.26.79-.58 0-.29-.01-1.06-.02-2.08-3.2.71-3.88-1.58-3.88-1.58-.53-1.38-1.3-1.75-1.3-1.75-1.06-.74.08-.72.08-.72 1.17.09 1.78 1.22 1.78 1.22 1.04 1.83 2.72 1.3 3.38.99.1-.77.41-1.3.74-1.6-2.56-.3-5.24-1.31-5.24-5.82 0-1.28.44-2.33 1.16-3.15-.12-.3-.5-1.5.11-3.12 0 0 .95-.31 3.11 1.2a10.45 10.45 0 0 1 2.83-.39c.96 0 1.92.13 2.83.39 2.16-1.5 3.1-1.2 3.1-1.2.62 1.62.24 2.82.12 3.12.72.82 1.15 1.87 1.15 3.15 0 4.52-2.69 5.52-5.25 5.81.42.37.8 1.1.8 2.22 0 1.6-.01 2.88-.01 3.27 0 .32.2.7.8.58A11.31 11.31 0 0 0 23.25 12.05C23.25 5.67 18.27.5 12 .5z" />
            </svg>
            查看
          </a>
        </div>
      </div>
    </div>
  )
}

function ArticleItem({ article, categories }: { article: Article; categories: Category[] }) {
  return (
    <Link
      to={`/articles/${article.id}`}
      className="flex items-start justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
          {article.title}
        </h3>
        {article.category && (
          <span className="text-xs text-zinc-400 mt-0.5 block truncate">
            {formatCategoryPath(categories, article.category.id) || article.category.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-zinc-400 shrink-0 ml-4">
        <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(article.createdAt)}</span>
      </div>
    </Link>
  )
}
