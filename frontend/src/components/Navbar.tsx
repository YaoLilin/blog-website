import { Moon, Search, Settings, Sun } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { cn, formatDate } from '../lib/utils'
import { formatCategoryPath } from '../lib/category'
import { useAuthStore } from '../stores/authStore'
import { useTheme } from '../theme-provider'
import { isTokenExpired } from '../lib/jwt'
import type { Article, Category } from '../types'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { SITE_CONFIG } from '../config/site'


interface CategoryMenuProps {
  categories: Category[]
  depth?: number
}

function CategoryMenu({ categories, depth = 0 }: CategoryMenuProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  return (
    <div className={cn(
      'absolute bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg min-w-[160px] z-50',
      depth === 0 ? 'top-full left-0 -mt-px' : 'top-0 left-full -ml-px'
    )}>
      {categories.map(cat => (
        <div key={cat.id} className="relative" onMouseEnter={() => setHoveredId(cat.id)} onMouseLeave={() => setHoveredId(null)}>
          <Link
            to={`/categories/${cat.id}`}
            className="flex items-center justify-between px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            {cat.name}
            {cat.children && cat.children.length > 0 && <span className="ml-2">›</span>}
          </Link>
          {cat.children && cat.children.length > 0 && hoveredId === cat.id && (
            <CategoryMenu categories={cat.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  )
}

export function Navbar() {
  const { theme, themeMode, setThemeMode } = useTheme()
  const { isAdmin } = useAuthStore()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [showArticleMenu, setShowArticleMenu] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [searchDialogLoading, setSearchDialogLoading] = useState(false)
  const [searchDialogHasSearched, setSearchDialogHasSearched] = useState(false)
  const [searchDialogResults, setSearchDialogResults] = useState<Article[]>([])
  const [searchTitleOnly, setSearchTitleOnly] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const articleMenuRef = useRef<HTMLDivElement>(null)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const searchDialogInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getCategoryTree().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowSearchDialog(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!showSearchDialog) return
    window.setTimeout(() => searchDialogInputRef.current?.focus(), 0)
  }, [showSearchDialog])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false)
      }
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}&titleOnly=${searchTitleOnly}`)
      setShowSearchDialog(false)
      setSearchDialogHasSearched(false)
      setSearchDialogResults([])
      setSearchValue('')
    }
  }

  const runDialogSearch = async (keyword: string) => {
    const q = keyword.trim()
    setSearchValue(q)
    if (!q) {
      setSearchDialogResults([])
      setSearchDialogHasSearched(false)
      return
    }

    setSearchDialogLoading(true)
    setSearchDialogHasSearched(true)
    try {
      const results = await api.searchArticles(q, searchTitleOnly)
      setSearchDialogResults(results)
    } catch {
      setSearchDialogResults([])
    } finally {
      setSearchDialogLoading(false)
    }
  }

  const location = useLocation()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const scrollTargetRef = useRef<string | null>(null)
  const mountTimeRef = useRef(Date.now())
  const lastActiveRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (location.pathname !== '/') {
      return
    }
    const flagP = sessionStorage.getItem('scrollToProjects')
    const flagA = sessionStorage.getItem('scrollToAbout')
    if (flagP === '1') {
      scrollTargetRef.current = 'projects'
      setActiveSection('projects')
      setTimeout(() => { scrollTargetRef.current = null }, 2000)
    }
    if (flagA === '1') {
      scrollTargetRef.current = 'about'
      setActiveSection('about')
      setTimeout(() => { scrollTargetRef.current = null }, 2000)
    }
  }, [location.pathname])

  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveSection(null)
      lastActiveRef.current = null
      return
    }
    mountTimeRef.current = Date.now()
    lastActiveRef.current = null

    const NAVBAR_H = 56
    const ACTIVE_OFFSET = 100

    const handleScroll = () => {
      if (scrollTargetRef.current) return
      if (Date.now() - mountTimeRef.current < 500) return

      const projectsEl = document.getElementById('projects')
      const aboutEl = document.getElementById('about')
      if (!projectsEl || !aboutEl) return

      const scrollPos = window.scrollY + NAVBAR_H + ACTIVE_OFFSET
      const projectsTop = projectsEl.offsetTop
      const aboutTop = aboutEl.offsetTop

      let next: string | null = null
      if (scrollPos >= aboutTop) {
        next = 'about'
      } else if (scrollPos >= projectsTop) {
        next = 'projects'
      }

      if (next !== lastActiveRef.current) {
        lastActiveRef.current = next
        setActiveSection(next)
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [location.pathname])

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    if (path === '/categories') return location.pathname.startsWith('/categories')
    return location.pathname.startsWith(path)
  }

  const handleProjectClick = () => {
    if (location.pathname === '/') {
      scrollTargetRef.current = 'projects'
      setActiveSection('projects')
      document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => { scrollTargetRef.current = null }, 800)
    } else {
      sessionStorage.setItem('scrollToProjects', '1')
      navigate('/')
    }
  }

  const handleAboutClick = () => {
    if (location.pathname === '/') {
      scrollTargetRef.current = 'about'
      setActiveSection('about')
      document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => { scrollTargetRef.current = null }, 800)
    } else {
      sessionStorage.setItem('scrollToAbout', '1')
      navigate('/')
    }
  }

  const shortcutLabel = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="font-bold text-lg shrink-0 hover:opacity-80 transition-opacity">
          {SITE_CONFIG.siteId}
        </Link>

        {/* 导航按钮 */}
        <div className="flex items-center gap-1">
          {/* 文章按钮（带多级下拉菜单） */}
          <div
            ref={articleMenuRef}
            className="relative"
            onMouseEnter={() => setShowArticleMenu(true)}
            onMouseLeave={() => setShowArticleMenu(false)}
          >
            <Link
              to="/categories"
              className="relative inline-flex items-center h-8 px-3 rounded-md text-sm leading-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              文章
              {isActive('/categories') && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />}
            </Link>
            {showArticleMenu && categories.length > 0 && (
              <CategoryMenu categories={categories} />
            )}
          </div>

          <button
            type="button"
            onClick={handleProjectClick}
            className="relative inline-flex items-center h-8 px-3 rounded-md text-sm leading-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            项目
            <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-300 ${activeSection === 'projects' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
          </button>

          <button
            type="button"
            onClick={handleAboutClick}
            className="relative inline-flex items-center h-8 px-3 rounded-md text-sm leading-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            关于我
            <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-300 ${activeSection === 'about' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
          </button>
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2 ml-auto">
          {/* 搜索输入框 */}
          <form onSubmit={handleSearch} className="relative w-64">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder={`搜索文章... 按 ${shortcutLabel}`}
              className="h-8 pl-9 pr-16 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowSearchDialog(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-200 dark:border-zinc-700 bg-background px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title={`按 ${shortcutLabel} 打开搜索对话框`}
            >
              {shortcutLabel}
            </button>
          </form>

          {/* 主题切换 */}
          <div ref={themeMenuRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowThemeMenu(v => !v)}
              className="h-8 w-8"
              title={themeMode === 'dark' ? '深色' : themeMode === 'light' ? '浅色' : '自动'}
            >
              {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </Button>
            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-2 min-w-24 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 shadow-lg z-50">
                {[
                  { value: 'system', label: '自动' },
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setThemeMode(opt.value as 'light' | 'dark' | 'system')
                      setShowThemeMenu(false)
                    }}
                    className={`block w-full rounded px-3 py-2 text-left text-sm ${
                      themeMode === opt.value
                        ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GitHub 链接 */}
          <a href="https://github.com/yaolilin" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M12 .5C5.73.5.75 5.67.75 12.05c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.26.79-.58 0-.29-.01-1.06-.02-2.08-3.2.71-3.88-1.58-3.88-1.58-.53-1.38-1.3-1.75-1.3-1.75-1.06-.74.08-.72.08-.72 1.17.09 1.78 1.22 1.78 1.22 1.04 1.83 2.72 1.3 3.38.99.1-.77.41-1.3.74-1.6-2.56-.3-5.24-1.31-5.24-5.82 0-1.28.44-2.33 1.16-3.15-.12-.3-.5-1.5.11-3.12 0 0 .95-.31 3.11 1.2a10.45 10.45 0 0 1 2.83-.39c.96 0 1.92.13 2.83.39 2.16-1.5 3.1-1.2 3.1-1.2.62 1.62.24 2.82.12 3.12.72.82 1.15 1.87 1.15 3.15 0 4.52-2.69 5.52-5.25 5.81.42.37.8 1.1.8 2.22 0 1.6-.01 2.88-.01 3.27 0 .32.2.7.8.58A11.31 11.31 0 0 0 23.25 12.05C23.25 5.67 18.27.5 12 .5z" />
              </svg>
            </Button>
          </a>

          {/* 后台按钮 */}
          {isAdmin && !isTokenExpired() && (
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="后台管理">
                <Settings size={16} />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 搜索对话框 */}
      <Dialog
        open={showSearchDialog}
        onOpenChange={(open) => {
          setShowSearchDialog(open)
          if (!open) {
            setSearchDialogLoading(false)
            setSearchDialogHasSearched(false)
            setSearchDialogResults([])
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>搜索文章</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void runDialogSearch(searchValue)
            }}
            className="space-y-4"
          >
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                ref={searchDialogInputRef}
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                placeholder={`输入关键词，按 ${shortcutLabel} 搜索`}
                className="h-10 pl-9 pr-20"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-200 dark:border-zinc-700 bg-background px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                搜索
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-500 select-none">
              <input
                type="checkbox"
                checked={searchTitleOnly}
                onChange={e => {
                  const next = e.target.checked
                  setSearchTitleOnly(next)
                  if (searchDialogHasSearched && searchValue.trim()) {
                    void api.searchArticles(searchValue.trim(), next)
                      .then(setSearchDialogResults)
                      .catch(() => setSearchDialogResults([]))
                  }
                }}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              />
              只搜索文章标题
            </label>

            <div className="max-h-[60vh] overflow-y-auto">
              {searchDialogLoading ? (
                <div className="text-center text-zinc-400 py-12">搜索中...</div>
              ) : searchDialogHasSearched ? (
                searchDialogResults.length === 0 ? (
                  <div className="text-center text-zinc-400 py-12">没有找到相关文章</div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-zinc-500">
                      搜索"{searchValue}"的结果
                      <span className="text-zinc-400 ml-2">({searchDialogResults.length} 篇)</span>
                    </div>
                    {searchDialogResults.map(a => (
                      <Link
                        key={a.id}
                        to={`/articles/${a.id}`}
                        onClick={() => setShowSearchDialog(false)}
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
                )
              ) : (
                <div className="text-center text-zinc-400 py-12">输入关键词后按回车搜索</div>
              )}
            </div>
          </form>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowSearchDialog(false)
                setSearchDialogLoading(false)
                setSearchDialogHasSearched(false)
                setSearchDialogResults([])
              }}
            >
              关闭
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowSearchDialog(false)
                navigate(
                  searchValue.trim()
                    ? `/search?q=${encodeURIComponent(searchValue.trim())}&titleOnly=${searchTitleOnly}`
                    : '/search',
                )
              }}
            >
              打开搜索页
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </nav>
  )
}
