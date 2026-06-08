import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import { Calendar, RefreshCw, Eye, Edit, Save, X, ChevronRight, PanelLeftClose, PanelLeftOpen, FileText } from 'lucide-react'
import { api } from '../api'
import type { Article, Category } from '../types'
import { useAuthStore } from '../stores/authStore'
import { formatDate } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { VditorEditor } from '../components/VditorEditor'
import { SITE_CONFIG } from '../config/site'

interface TocItem {
  id: string
  level: number
  text: string
  line: number
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractToc(content: string): TocItem[] {
  const lines = content.split('\n')
  const toc: TocItem[] = []
  const counts: Record<string, number> = {}
  let inCodeBlock = false
  lines.forEach((line, idx) => {
    // 检测围栏代码块的开闭（``` 或 ~~~）
    if (/^(`{3,}|~{3,})/.test(line)) {
      inCodeBlock = !inCodeBlock
      return
    }
    if (inCodeBlock) return
    const m = line.match(/^(#{2,6})\s+(.+)$/)
    if (m) {
      const text = m[2]
      const base = slugifyHeading(text)
      counts[base] = (counts[base] || 0) + 1
      const id = counts[base] > 1 ? `${base}-${counts[base]}` : base
      toc.push({ id, level: m[1].length, text, line: idx + 1 })
    }
  })
  return toc
}

function decodePath(path: string) {
  let value = path
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(value)
      if (next === value) break
      value = next
    } catch {
      break
    }
  }
  return value
}

function normalizeImageSrc(src?: string) {
  if (!src) return src
  if (src.startsWith('./data:')) return src.slice(2)
  if (src.startsWith('.\\data:')) return src.slice(2)
  return src
}

function stripMarkdownComments(content: string) {
  return content.replace(/<!--[\s\S]*?-->/g, '')
}

function transformMarkdownUrl(url?: string) {
  if (!url) return url
  const decoded = decodePath(url)
  const normalized = normalizeImageSrc(decoded) ?? ''
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:') ||
    normalized.startsWith('/')
  ) {
    return normalized
  }
  return normalized
}

function isImageUrl(url?: string) {
  if (!url) return false
  const clean = url.split('?')[0].split('#')[0].toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(clean)
}

function getFileNameFromUrl(url?: string) {
  if (!url) return 'download'
  const clean = url.split('?')[0].split('#')[0]
  const name = clean.split('/').pop()
  return name ? decodePath(name) : 'download'
}

export function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { isAdmin } = useAuthStore()
  const [article, setArticle] = useState<Article | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Category[]>([])
  const [allTocItems, setAllTocItems] = useState<TocItem[]>([])
  const [toc, setToc] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tocOpen, setTocOpen] = useState(true)
  const [editTitle, setEditTitle] = useState('')
  const [gitRemoteUrl, setGitRemoteUrl] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const articleHeaderRef = useRef<HTMLDivElement>(null)
  // 点击目录后的"静默期"，期间忽略 IntersectionObserver 的高亮更新
  const suppressObserverUntilRef = useRef<number>(0)
  const editOpenedByQueryRef = useRef(false)

  const docsPath = searchParams.get('path')

  const activeTocId = useMemo(() => {
    if (!activeId) return ''
    const currentIdx = allTocItems.findIndex(t => t.id === activeId)
    if (currentIdx === -1) return activeId

    const current = allTocItems[currentIdx]
    if (current.level <= 3) return current.id

    for (let i = currentIdx - 1; i >= 0; i--) {
      if (allTocItems[i].level <= 3) return allTocItems[i].id
    }
    return toc[0]?.id || current.id
  }, [activeId, allTocItems, toc])

  const activeLevel3Id = useMemo(() => {
    if (!activeId) return ''
    const currentIdx = allTocItems.findIndex(t => t.id === activeId)
    if (currentIdx === -1) return ''

    const current = allTocItems[currentIdx]
    if (current.level === 3) return current.id
    if (current.level > 3) {
      for (let i = currentIdx - 1; i >= 0; i--) {
        if (allTocItems[i].level === 3) return allTocItems[i].id
        if (allTocItems[i].level < 3) break
      }
    }
    return ''
  }, [activeId, allTocItems])

  useEffect(() => {
    editOpenedByQueryRef.current = false
  }, [id, docsPath])

  useEffect(() => {
    if (!id && !docsPath) return
    setLoading(true)
    const articlePromise = docsPath ? api.getArticleByPath(docsPath) : api.getArticle(Number(id))
    Promise.all([
      articlePromise,
      api.getCategoryTree(),
    ]).then(([art, tree]) => {
      setArticle(art)
      setEditTitle(art.title)
      setEditContent(art.content)

      const findPath = (cats: Category[], targetId: number, path: Category[] = []): Category[] | null => {
        for (const cat of cats) {
          if (cat.id === targetId) return [...path, cat]
          if (cat.children) {
            const found = findPath(cat.children, targetId, [...path, cat])
            if (found) return found
          }
        }
        return null
      }
      const path = findPath(tree, art.categoryId)
      setBreadcrumb(path || [])

      const cleanedContent = stripMarkdownComments(art.content)
      const allToc = extractToc(cleanedContent)
      setAllTocItems(allToc)
      setToc(allToc.filter(t => t.level <= 3))

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id, docsPath, isAdmin])

  useEffect(() => {
    if (!article) return
    setEditTitle(article.title)
  }, [article])

  useEffect(() => {
    if (!article) return
    document.title = article.title
  }, [article])

  useEffect(() => {
    if (!article || isAdmin) return
    api.recordView(article.id).catch(() => {})
  }, [article, isAdmin])

  useEffect(() => {
    if (!article || !article.isServerManaged) {
      setGitRemoteUrl('')
      return
    }
    api.getArticleGitRemote(article.id).then(r => setGitRemoteUrl(r.url)).catch(() => {})
  }, [article])

  const editFromQuery = searchParams.get('edit') === '1'

  const startEdit = () => {
    if (!article) return
    setEditTitle(article.title)
    setEditContent(article.content)
    setEditMode(true)
  }

  useEffect(() => {
    if (!article || !isAdmin || !editFromQuery || editOpenedByQueryRef.current) return
    editOpenedByQueryRef.current = true
    startEdit()
  }, [article, isAdmin, editFromQuery])

  useEffect(() => {
    if (!contentRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        // 点击目录后的静默期，跳过 observer 的高亮更新
        if (Date.now() < suppressObserverUntilRef.current) return
        // 取所有当前相交的标题里最靠上的那个，避免被下方标题覆盖
        const visible = entries
          .filter(e => e.isIntersecting)
          .map(e => ({ id: e.target.id, top: e.boundingClientRect.top }))
          .sort((a, b) => a.top - b.top)
        if (visible.length === 0) return
        const topId = visible[0].id
        setActiveId(topId)
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    )
    const headings = contentRef.current.querySelectorAll('h2, h3, h4, h5, h6')
    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [article, toc, allTocItems])

  const handleSave = async () => {
    if (!article) return
    if (!editTitle.trim()) {
      alert('请输入标题')
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateArticle(article.id, {
        title: editTitle,
        content: editContent,
      })
      setArticle(updated)
      setEditMode(false)
      setEditTitle(updated.title)
      setEditContent(updated.content)
      const allToc = extractToc(stripMarkdownComments(editContent))
      setAllTocItems(allToc)
      setToc(allToc.filter(t => t.level <= 3))
    } catch {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 用源码行号查 id，和 re-render、渲染顺序无关
  const displayContent = useMemo(() => stripMarkdownComments(article?.content ?? ''), [article?.content])

  const tocByLine = useMemo(() => {
    const map = new Map<number, string>()
    extractToc(displayContent).forEach(t => map.set(t.line, t.id))
    return map
  }, [displayContent])

  type MdNode = { position?: { start?: { line?: number } } }
  const idFromNode = (node: unknown) => {
    const line = (node as MdNode)?.position?.start?.line
    return (line && tocByLine.get(line)) || ''
  }

  const markdownComponents = useMemo(() => ({
    h2: ({ node, children, ...props }: React.ComponentPropsWithRef<'h2'> & { node?: unknown }) => <h2 id={idFromNode(node)} {...props}>{children}</h2>,
    h3: ({ node, children, ...props }: React.ComponentPropsWithRef<'h3'> & { node?: unknown }) => <h3 id={idFromNode(node)} {...props}>{children}</h3>,
    h4: ({ node, children, ...props }: React.ComponentPropsWithRef<'h4'> & { node?: unknown }) => <h4 id={idFromNode(node)} {...props}>{children}</h4>,
    h5: ({ node, children, ...props }: React.ComponentPropsWithRef<'h5'> & { node?: unknown }) => <h5 id={idFromNode(node)} {...props}>{children}</h5>,
    h6: ({ node, children, ...props }: React.ComponentPropsWithRef<'h6'> & { node?: unknown }) => <h6 id={idFromNode(node)} {...props}>{children}</h6>,
    img: ({ node, src, alt, ...props }: React.ComponentPropsWithRef<'img'> & { node?: unknown }) => {
      const rawSrc = src || (node as { properties?: { src?: string } })?.properties?.src
      const fixedSrc = transformMarkdownUrl(typeof rawSrc === 'string' ? rawSrc : undefined)
      if (!isImageUrl(fixedSrc)) {
        const fileName = getFileNameFromUrl(fixedSrc)
        const handleDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault()
          const link = document.createElement('a')
          link.href = fixedSrc || ''
          link.download = fileName
          link.click()
        }
        return (
          <span
            onClick={handleDownload}
            className="not-prose inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 no-underline hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            title={fileName}
          >
            <FileText size={16} className="shrink-0" />
            <span className="truncate max-w-[28rem]">{alt || fileName}</span>
          </span>
        )
      }
      return <img src={fixedSrc} alt={alt || ''} loading="lazy" decoding="async" {...props} />
    },
    a: ({ node: _node, href, children, ...props }: React.ComponentPropsWithRef<'a'> & { node?: unknown }) => {
      const isDocsMarkdown = href?.includes('/docs-static/') && href?.toLowerCase().endsWith('.md')
      if (isDocsMarkdown) {
        const targetPath = decodePath(href!)
        return (
          <a href={`/articles/view?path=${encodeURIComponent(targetPath)}`} target="_blank" rel="noreferrer" {...props}>
            {children}
          </a>
        )
      }
      const isStatic = href?.includes('/static/')
      if (isStatic) {
        const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
          const target = e.currentTarget as HTMLAnchorElement & { _lastClick?: number }
          const last = target._lastClick || 0
          const now = Date.now()
          if (now - last < 400) {
            e.preventDefault()
            const link = document.createElement('a')
            link.href = href!
            link.download = href!.split('/').pop() || 'download'
            link.click()
          }
          target._lastClick = now
        }
        return <a href={href} onClick={handleClick} title="双击下载" {...props}>{children}</a>
      }
      return <a href={href} {...props}>{children}</a>
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tocByLine])

  const activeH3 = toc.find(t => t.id === activeLevel3Id && t.level === 3)
  const subTocForActiveH3 = (() => {
    if (!activeH3) return []
    const startIdx = allTocItems.findIndex(t => t.id === activeH3.id && t.level === 3)
    if (startIdx === -1) return []
    const endIdx = allTocItems.findIndex((t, i) => i > startIdx && t.level <= 3)
    const slice = allTocItems.slice(startIdx + 1, endIdx === -1 ? undefined : endIdx)
    return slice.filter(t => t.level > 3)
  })()

  const activeSubTocId = useMemo(() => {
    if (!activeId || subTocForActiveH3.length === 0) return ''
    return subTocForActiveH3.some(item => item.id === activeId)
      ? activeId
      : subTocForActiveH3[0]?.id || ''
  }, [activeId, subTocForActiveH3])

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return

    // 屏蔽 observer 600ms，避免滚动过程中被下方标题覆盖
    suppressObserverUntilRef.current = Date.now() + 600

    // 导航栏高度（sticky top-14 = 3.5rem = 56px）
    const NAVBAR = 56
    const ARTICLE_HEADER = articleHeaderRef.current?.offsetHeight ?? 96
    const scrollTo = (target: HTMLElement) => {
      const top = target.getBoundingClientRect().top + window.scrollY - NAVBAR - ARTICLE_HEADER - 12
      window.scrollTo({ top, behavior: 'instant' })
    }

    scrollTo(el)
    setActiveId(id)

    // 图片懒加载后布局变化，200ms 后再修正一次
    setTimeout(() => {
      const el2 = document.getElementById(id)
      if (el2) scrollTo(el2)
    }, 200)
  }

  if (loading) return <div className="container mx-auto px-4 py-8 text-center">加载中...</div>
  if (!article) return <div className="container mx-auto px-4 py-8 text-center text-zinc-400">文章不存在</div>

  return (
    <>
      <Helmet>
        <title>{article.title} - {SITE_CONFIG.name}</title>
        <meta name="description" content={article.title} />
        <meta property="og:title" content={`${article.title} - ${SITE_CONFIG.name}`} />
        <meta property="og:description" content={article.title} />
      </Helmet>
      <div className="flex gap-0">
      {/* 左侧：目录 + 分类导航 */}
      <aside
        className={`shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-[width] duration-200 overflow-hidden ${
          tocOpen ? 'w-60' : 'w-9'
        }`}
      >
        {/* 顶部：面包屑 + 收缩按钮（固定，不随内容滚动） */}
        <div className="shrink-0 flex items-start gap-1 px-2 py-3 border-b border-zinc-100 dark:border-zinc-800">
          {tocOpen && breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-zinc-500 flex-wrap flex-1 min-w-0">
              {breadcrumb.map((cat, i) => (
                <span key={cat.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={10} />}
                  <Link to={`/categories/${cat.id}`} className="hover:text-zinc-900 dark:hover:text-zinc-100 break-all">
                    {cat.name}
                  </Link>
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => setTocOpen(o => !o)}
            className="shrink-0 ml-auto p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            title={tocOpen ? '收起目录' : '展开目录'}
          >
            {tocOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
        </div>

        {/* 目录列表（可滚动） */}
        {tocOpen && (
          <div className="flex-1 overflow-y-auto p-3">
            {toc.length > 0 ? (
              <>
                <p className="text-xs font-medium text-zinc-400 uppercase mb-2">目录</p>
                <nav className="space-y-1">
                  {toc.map(item => (
                    <button
                      key={item.id}
                      onClick={() => scrollToHeading(item.id)}
                      className={`block w-full text-left text-xs py-1 px-2 rounded truncate transition-colors ${
                        activeTocId === item.id
                          ? 'text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800'
                          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                      style={{ paddingLeft: `${8 + (item.level - 2) * 12}px` }}
                    >
                      {item.text}
                    </button>
                  ))}
                </nav>
              </>
            ) : (
              <p className="text-xs text-zinc-400">暂无目录</p>
            )}
          </div>
        )}

      </aside>

      {/* 中间：文章内容 */}
      <main className="flex-1 min-w-0 px-6 py-8">
        <div className="mx-auto max-w-3xl">
        <div ref={articleHeaderRef} className="sticky top-14 z-10 -mx-6 mb-6 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {editMode ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-zinc-600 dark:text-zinc-300">文章标题</label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="文章标题" className="h-10" />
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-7">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save size={14} className="mr-1" />{saving ? '保存中...' : '保存'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditMode(false)
                    setEditTitle(article.title)
                    setEditContent(article.content)
                  }}>
                    <X size={14} className="mr-1" />取消
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1"><Calendar size={14} />{formatDate(article.createdAt)}</span>
                {article.updatedAt !== article.createdAt && (
                  <span className="flex items-center gap-1"><RefreshCw size={14} />更新于 {formatDate(article.updatedAt)}</span>
                )}
                {isAdmin && <span className="flex items-center gap-1"><Eye size={14} />{article.viewCount} 次阅读</span>}
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-3 flex items-center gap-2">
                {article.title}
                {gitRemoteUrl && (
                  <a href={gitRemoteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" title="查看仓库">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 .5C5.73.5.75 5.67.75 12.05c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.26.79-.58 0-.29-.01-1.06-.02-2.08-3.2.71-3.88-1.58-3.88-1.58-.53-1.38-1.3-1.75-1.3-1.75-1.06-.74.08-.72.08-.72 1.17.09 1.78 1.22 1.78 1.22 1.04 1.83 2.72 1.3 3.38.99.1-.77.41-1.3.74-1.6-2.56-.3-5.24-1.31-5.24-5.82 0-1.28.44-2.33 1.16-3.15-.12-.3-.5-1.5.11-3.12 0 0 .95-.31 3.11 1.2a10.45 10.45 0 0 1 2.83-.39c.96 0 1.92.13 2.83.39 2.16-1.5 3.1-1.2 3.1-1.2.62 1.62.24 2.82.12 3.12.72.82 1.15 1.87 1.15 3.15 0 4.52-2.69 5.52-5.25 5.81.42.37.8 1.1.8 2.22 0 1.6-.01 2.88-.01 3.27 0 .32.2.7.8.58A11.31 11.31 0 0 0 23.25 12.05C23.25 5.67 18.27.5 12 .5z" /></svg>
                  </a>
                )}
              </h1>
              <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1"><Calendar size={14} />{formatDate(article.createdAt)}</span>
                {article.updatedAt !== article.createdAt && (
                  <span className="flex items-center gap-1"><RefreshCw size={14} />更新于 {formatDate(article.updatedAt)}</span>
                )}
                {isAdmin && <span className="flex items-center gap-1"><Eye size={14} />{article.viewCount} 次阅读</span>}
              </div>
            </>
          )}
        </div>

        {/* 编辑工具栏（仅管理员） */}
        {isAdmin && article.id && !editMode && (
          <div className="flex gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Edit size={14} className="mr-1" />编辑
            </Button>
          </div>
        )}

        {/* 文章内容 */}
        {editMode ? (
          <div className="min-h-[600px] rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
            <VditorEditor
              value={editContent}
              onChange={setEditContent}
              articleId={article.id}
              placeholder="编写 Markdown 内容... 可直接粘贴图片或文件"
              minHeight={600}
              className="h-full"
            />
          </div>
        ) : (
          <div ref={contentRef} className="prose dark:prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              urlTransform={transformMarkdownUrl}
              components={markdownComponents}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        )}
        </div>
      </main>

      {/* 右侧：下级标题目录 + 有帮助 */}
      <aside className="w-48 shrink-0 hidden xl:flex flex-col sticky top-14 h-[calc(100vh-3.5rem)] p-4">
        <div className="flex-1 overflow-y-auto">
          {subTocForActiveH3.length > 0 ? (
            <>
            <p className="text-xs font-medium text-zinc-400 uppercase mb-2">小节</p>
            <nav className="space-y-1">
              {subTocForActiveH3.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToHeading(item.id)}
                  className={`block w-full text-left text-xs py-1 px-2 rounded truncate transition-colors ${
                    activeSubTocId === item.id
                      ? 'text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                  style={{ paddingLeft: `${8 + (item.level - 4) * 12}px` }}
                >
                  {item.text}
                </button>
              ))}
            </nav>
            </>
          ) : (
            <div aria-hidden="true" />
          )}
        </div>


      </aside>
    </div>
    </>
  )
}
