import { useEffect, useState } from 'react'
import { Folder, FolderOpen, Plus, Search, Edit, Trash2, ArrowLeft, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { api } from '../../api'
import type { Article, Category } from '../../types'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { toast } from 'sonner'
import { formatDate } from '../../lib/utils'
import { dedupeArticles } from '../../lib/articles'
import { ArticleEditor } from './ArticleEditor'
import { CATEGORY_ICON_OPTIONS, getCategoryCoverKind } from '../../components/CategoryCover'

export function ArticleManagement() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list')
  const [loading, setLoading] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [addingChildParentId, setAddingChildParentId] = useState<number | null>(null)
  const [childCategoryName, setChildCategoryName] = useState('')
  const [draggingCategory, setDraggingCategory] = useState<Category | null>(null)
  const [moveTargetCategory, setMoveTargetCategory] = useState<Category | null>(null)
  const [moveConfirmOpen, setMoveConfirmOpen] = useState(false)
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<Category | null>(null)
  const [coverEditingCategory, setCoverEditingCategory] = useState<Category | null>(null)
  const [coverMode, setCoverMode] = useState<'icon' | 'image'>('image')
  const [coverIconName, setCoverIconName] = useState('Folder')
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [coverImagePreview, setCoverImagePreview] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [importRemoteOpen, setImportRemoteOpen] = useState(false)
  const [importRemoteUrl, setImportRemoteUrl] = useState('')
  const [importRemoteTargetId, setImportRemoteTargetId] = useState<number | null>(null)
  const [importRemoteMode, setImportRemoteMode] = useState<'category' | 'customPath'>('category')
  const [importRemoteCustomPath, setImportRemoteCustomPath] = useState('')
  const [importRemoteLoading, setImportRemoteLoading] = useState(false)

  useEffect(() => {
    api.getCategoryTree().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      loadArticles(selectedCategory.id)
    }
    // 重新拉取分类树后，按当前选中分类刷新文章列表
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  const collectCategoryIds = (cats: Category[], targetId?: number): number[] => {
    if (!targetId) return []
    const walk = (items: Category[]): number[] => {
      for (const cat of items) {
        if (cat.id === targetId) {
          const ids = new Set<number>([cat.id])
          const collectChildren = (node: Category) => {
            node.children?.forEach(child => {
              ids.add(child.id)
              collectChildren(child)
            })
          }
          collectChildren(cat)
          return [...ids]
        }
        if (cat.children?.length) {
          const found = walk(cat.children)
          if (found.length > 0) return found
        }
      }
      return []
    }
    return walk(cats)
  }

  const loadArticles = async (catId?: number) => {
    setLoading(true)
    try {
      if (!catId) {
        const r = await api.getArticles({ size: 100 })
        setArticles(r.content || [])
        return
      }

      const ids = collectCategoryIds(categories, catId)
      const results = await Promise.all(ids.map(id => api.getArticles({ categoryId: id, size: 100 })))
      const merged = results.flatMap(r => r.content || [])
      const deduped = dedupeArticles(merged)
      deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setArticles(deduped)
    } catch {
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat)
    setViewMode('list')
    loadArticles(cat.id)
  }

  const filteredArticles = articles.filter(a =>
    searchKeyword ? a.title.toLowerCase().includes(searchKeyword.toLowerCase()) : true
  )

  const handleDeleteArticle = async (id: number) => {
    if (!confirm('确定删除此文章？')) return
    await api.deleteArticle(id)
    loadArticles(selectedCategory?.id)
  }

  const handleDeleteCategory = async (cat: Category) => {
    setDeleteCategoryConfirm(cat)
  }

  const handleConfirmDeleteCategory = async () => {
    if (!deleteCategoryConfirm) return
    await api.deleteCategory(deleteCategoryConfirm.id)
    setDeleteCategoryConfirm(null)
    api.getCategoryTree().then(setCategories).catch(() => {})
  }

  const handleAddCategory = async (parentId: number | null = null) => {
    if (!newCategoryName.trim()) return
    await api.createCategory({ name: newCategoryName.trim(), parentId })
    setNewCategoryName('')
    setAddingCategory(false)
    api.getCategoryTree().then(setCategories).catch(() => {})
  }

  const handleAddChildCategory = async () => {
    if (addingChildParentId == null || !childCategoryName.trim()) return
    await api.createCategory({ name: childCategoryName.trim(), parentId: addingChildParentId })
    setChildCategoryName('')
    setAddingChildParentId(null)
    api.getCategoryTree().then(setCategories).catch(() => {})
  }

  const handleRenameCategory = async (cat: Category) => {
    if (!editingCategoryName.trim()) return
    await api.updateCategory(cat.id, { name: editingCategoryName.trim() })
    setEditingCategoryId(null)
    api.getCategoryTree().then(setCategories).catch(() => {})
  }

  const openCoverEditor = (cat: Category) => {
    const cover = getCategoryCoverKind(cat.coverImage)
    setCoverEditingCategory(cat)
    setCoverMode(cover.kind === 'image' ? 'image' : 'icon')
    setCoverIconName(cover.kind === 'icon' ? cover.value || 'Folder' : 'Folder')
    setCoverImageFile(null)
    setCoverImagePreview(cover.kind === 'image' ? cover.value : '')
  }

  const handleSaveCover = async () => {
    if (!coverEditingCategory) return
    const iconName = coverIconName.trim()
    let value = ''
    if (coverMode === 'icon') {
      value = iconName ? `icon:${iconName}` : ''
    } else {
      if (coverImageFile) {
        const result = await api.uploadFile(coverImageFile)
        value = result.url
      } else {
        value = coverImagePreview.trim()
      }
      if (!value) {
        toast.error('先选图片')
        return
      }
    }
    await api.updateCategory(coverEditingCategory.id, { coverImage: value || null })
    setCoverEditingCategory(null)
    setCoverImageFile(null)
    setCoverImagePreview('')
    setCoverIconName('Folder')
    setCoverMode('image')
    api.getCategoryTree().then(setCategories).catch(() => {})
  }

  const handleConfirmMoveCategory = async () => {
    if (!draggingCategory || !moveTargetCategory) return
    try {
      await api.moveCategory(draggingCategory.id, moveTargetCategory.id)
      setDraggingCategory(null)
      setMoveTargetCategory(null)
      setMoveConfirmOpen(false)
      api.getCategoryTree().then(setCategories).catch(() => {})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '移动失败')
      setDraggingCategory(null)
      setMoveTargetCategory(null)
      setMoveConfirmOpen(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.syncCategories()
      toast.success('文件同步完成')
      api.getCategoryTree().then(setCategories).catch(() => {})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  const handleImportRemoteRepo = async () => {
    const url = importRemoteUrl.trim()
    if (!url) {
      toast.error('请输入远程仓库地址')
      return
    }
    const isCustom = importRemoteMode === 'customPath'
    const customPath = importRemoteCustomPath.trim()
    if (isCustom && !customPath) {
      toast.error('请输入存放路径')
      return
    }
    setImportRemoteLoading(true)
    try {
      await api.cloneRemoteRepo(
        url,
        isCustom ? null : importRemoteTargetId,
        isCustom ? customPath : undefined,
      )
      toast.success('仓库导入成功')
      setImportRemoteOpen(false)
      setImportRemoteUrl('')
      setImportRemoteTargetId(null)
      setImportRemoteCustomPath('')
      setImportRemoteMode('category')
      api.getCategoryTree().then(setCategories).catch(() => {})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败')
    } finally {
      setImportRemoteLoading(false)
    }
  }

  if (viewMode === 'create') {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => setViewMode('list')}><ArrowLeft size={14} className="mr-1" />返回</Button>
        </div>
        <ArticleEditor
          categoryId={selectedCategory?.id}
          onSave={() => { setViewMode('list'); loadArticles(selectedCategory?.id) }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* 分类树 */}
      <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto p-3">
        <div className="mb-3 flex justify-start">
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={14} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} />{syncing ? '同步中' : '同步文章'}
          </Button>
        </div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">分类</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setImportRemoteOpen(true)}>
              从远程仓库获取
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAddingCategory(true)} title="添加根分类">
              <Plus size={12} />
            </Button>
          </div>
        </div>
        {addingCategory && (
          <div className="flex gap-1 mb-2">
            <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="分类名称" className="h-7 text-xs" autoFocus onKeyDown={e => e.key === 'Enter' && handleAddCategory(null)} />
            <Button size="sm" className="h-7 px-2" onClick={() => handleAddCategory(null)}>✓</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAddingCategory(false)}>✕</Button>
          </div>
        )}
        <CategoryTree
          categories={categories}
          selectedId={selectedCategory?.id}
          onSelect={handleSelectCategory}
          onDelete={handleDeleteCategory}
          onRename={(cat: Category) => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name) }}
          onAddChild={(cat: Category) => { setAddingChildParentId(cat.id); setChildCategoryName('') }}
          editingId={editingCategoryId}
          editingName={editingCategoryName}
          onEditingNameChange={setEditingCategoryName}
          onEditConfirm={handleRenameCategory}
          onEditCancel={() => setEditingCategoryId(null)}
          addingChildParentId={addingChildParentId}
          childCategoryName={childCategoryName}
          onChildCategoryNameChange={setChildCategoryName}
          onAddChildConfirm={handleAddChildCategory}
          onAddChildCancel={() => { setAddingChildParentId(null); setChildCategoryName('') }}
          draggingCategoryId={draggingCategory?.id}
          onDragStartCategory={cat => setDraggingCategory(cat)}
          onCoverEditCategory={openCoverEditor}
          onDropCategory={cat => {
            if (!draggingCategory || draggingCategory.id === cat.id) return
            if (!draggingCategory.isServerManaged && isServerManagedBranch(cat, categories)) {
              toast.error('普通分类不能移动到服务器管理分类下')
              setDraggingCategory(null)
              return
            }
            setMoveTargetCategory(cat)
            setMoveConfirmOpen(true)
          }}
          onDragEndCategory={() => {}}
        />
        <Dialog open={importRemoteOpen} onOpenChange={open => {
          setImportRemoteOpen(open)
          if (!open) {
            setImportRemoteUrl('')
            setImportRemoteTargetId(null)
            setImportRemoteCustomPath('')
            setImportRemoteMode('category')
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>从远程仓库获取</DialogTitle>
              <DialogDescription>
                输入远程仓库地址，选择存放位置。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={importRemoteUrl}
                onChange={e => setImportRemoteUrl(e.target.value)}
                placeholder="https://github.com/owner/repo.git"
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">存放位置</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={importRemoteMode === 'category'}
                      onChange={() => setImportRemoteMode('category')}
                      className="accent-zinc-700 dark:accent-zinc-300"
                    />
                    选择已有分类
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={importRemoteMode === 'customPath'}
                      onChange={() => setImportRemoteMode('customPath')}
                      className="accent-zinc-700 dark:accent-zinc-300"
                    />
                    手动输入路径
                  </label>
                </div>
              </div>

              {importRemoteMode === 'category' ? (
                <div className="max-h-64 overflow-y-auto rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                  <ServerManagedCategorySelector
                    categories={categories}
                    selectedId={importRemoteTargetId}
                    onSelect={setImportRemoteTargetId}
                  />
                </div>
              ) : (
                <Input
                  value={importRemoteCustomPath}
                  onChange={e => setImportRemoteCustomPath(e.target.value)}
                  placeholder="例如: new-folder/my-repo"
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportRemoteOpen(false)}>
                取消
              </Button>
              <Button onClick={handleImportRemoteRepo} disabled={importRemoteLoading}>
                {importRemoteLoading ? '导入中...' : '确定'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={!!deleteCategoryConfirm} onOpenChange={open => {
          if (!open) setDeleteCategoryConfirm(null)
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除分类</DialogTitle>
              <DialogDescription>
                确定要删除分类 <span className="font-medium text-foreground">{deleteCategoryConfirm?.name}</span>？
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-4 py-3 text-sm text-red-800 dark:text-red-200">
              <span className="font-medium">⚠ 警告：</span>
              删除此分类将<strong>同时删除该分类下的所有文章</strong>，此操作不可恢复！
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteCategoryConfirm(null)}>
                取消
              </Button>
              <Button variant="destructive" onClick={handleConfirmDeleteCategory}>确认删除</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={moveConfirmOpen} onOpenChange={open => {
          setMoveConfirmOpen(open)
          if (!open) {
            setMoveTargetCategory(null)
            setDraggingCategory(null)
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认移动分类</DialogTitle>
              <DialogDescription>
                将 <span className="font-medium text-foreground">{draggingCategory?.name}</span> 移动到
                <span className="font-medium text-foreground"> {moveTargetCategory?.name}</span> 下面？
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setMoveConfirmOpen(false)
                setMoveTargetCategory(null)
                setDraggingCategory(null)
              }}>
                取消
              </Button>
              <Button onClick={handleConfirmMoveCategory}>确认移动</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!coverEditingCategory} onOpenChange={open => {
          if (!open) {
            setCoverEditingCategory(null)
            setCoverMode('image')
            setCoverIconName('Folder')
            setCoverImageFile(null)
            setCoverImagePreview('')
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>设置分类封面</DialogTitle>
              <DialogDescription>
                给 <span className="font-medium text-foreground">{coverEditingCategory?.name}</span> 配置图标或图片。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">封面类型</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={coverMode === 'icon'}
                      onChange={() => setCoverMode('icon')}
                    />
                    图标
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={coverMode === 'image'}
                      onChange={() => setCoverMode('image')}
                    />
                    图片
                  </label>
                </div>
              </div>
              {coverMode === 'icon' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">图标</label>
                  <select
                    value={coverIconName}
                    onChange={e => setCoverIconName(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {CATEGORY_ICON_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">图片</label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0] || null
                      setCoverImageFile(file)
                      if (file) {
                        setCoverImagePreview(URL.createObjectURL(file))
                      }
                    }}
                  />
                  {coverImagePreview && (
                    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <img src={coverImagePreview} alt="预览" className="h-28 w-full object-cover" />
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setCoverEditingCategory(null)
                setCoverMode('image')
                setCoverIconName('Folder')
                setCoverImageFile(null)
                setCoverImagePreview('')
              }}>
                取消
              </Button>
              <Button onClick={handleSaveCover}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 文章列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedCategory ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">{selectedCategory.name}</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2 text-zinc-400" />
                  <Input
                    value={searchKeyword}
                    onChange={e => setSearchKeyword(e.target.value)}
                    placeholder="搜索文章..."
                    className="pl-8 h-8 w-48 text-xs"
                  />
                </div>
                <Button size="sm" onClick={() => setViewMode('create')}>
                  <Plus size={14} className="mr-1" />新建文章
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center text-zinc-400 py-8">加载中...</div>
            ) : filteredArticles.length === 0 ? (
              <div className="text-center text-zinc-400 py-8">暂无文章</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left py-2 font-medium">标题</th>
                    <th className="text-left py-2 font-medium">创建日期</th>
                    <th className="text-left py-2 font-medium">阅读数</th>
                    <th className="text-right py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArticles.map(a => (
                    <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="py-2">
                        <button onClick={() => window.open(`/articles/${a.id}`, '_blank', 'noopener,noreferrer')} className="text-left hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-xs block">
                          {a.title}
                        </button>
                      </td>
                      <td className="py-2 text-zinc-400 text-xs">{formatDate(a.createdAt)}</td>
                      <td className="py-2 text-zinc-400 text-xs">{a.viewCount}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(`/articles/${a.id}?edit=1`, '_blank', 'noopener,noreferrer')}><Edit size={12} /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteArticle(a.id)}><Trash2 size={12} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <div className="text-center text-zinc-400 py-12">选择左侧分类查看文章</div>
        )}
      </div>
    </div>
  )
}

function ServerManagedCategorySelector({
  categories,
  selectedId,
  onSelect,
  depth = 0,
}: {
  categories: Category[]
  selectedId: number | null
  onSelect: (id: number | null) => void
  depth?: number
}) {
  return (
    <div className="space-y-1">
      {depth === 0 && (
        <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
          <input
            type="radio"
            name="remoteRepoTarget"
            checked={selectedId === null}
            onChange={() => onSelect(null)}
            className="accent-zinc-700 dark:accent-zinc-300"
          />
          <span>根目录</span>
        </label>
      )}
      {categories.map(cat => (
        <div key={cat.id}>
          {cat.isServerManaged && (
            <label
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
              style={{ paddingLeft: `${depth * 18 + 8}px` }}
            >
              <input
                type="radio"
                name="remoteRepoTarget"
                checked={selectedId === cat.id}
                onChange={() => onSelect(cat.id)}
                className="accent-zinc-700 dark:accent-zinc-300"
              />
              <span className="truncate">{cat.name}</span>
            </label>
          )}
          {cat.children?.length ? (
            <ServerManagedCategorySelector
              categories={cat.children}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

interface CategoryTreeProps {
  categories: Category[]
  selectedId?: number
  onSelect: (cat: Category) => void
  onDelete: (cat: Category) => void
  onRename: (cat: Category) => void
  onAddChild: (cat: Category) => void
  editingId: number | null
  editingName: string
  onEditingNameChange: (name: string) => void
  onEditConfirm: (cat: Category) => void
  onEditCancel: () => void
  addingChildParentId: number | null
  childCategoryName: string
  onChildCategoryNameChange: (name: string) => void
  onAddChildConfirm: () => void
  onAddChildCancel: () => void
  draggingCategoryId?: number | null
  onDragStartCategory: (cat: Category) => void
  onCoverEditCategory: (cat: Category) => void
  onDropCategory: (cat: Category) => void
  onDragEndCategory: () => void
  serverManagedBranch?: boolean
  depth?: number
}

function CategoryTree({ categories, selectedId, onSelect, onDelete, onRename, onAddChild, editingId, editingName, onEditingNameChange, onEditConfirm, onEditCancel, addingChildParentId, childCategoryName, onChildCategoryNameChange, onAddChildConfirm, onAddChildCancel, draggingCategoryId, onDragStartCategory, onCoverEditCategory, onDropCategory, onDragEndCategory, serverManagedBranch = false, depth = 0 }: CategoryTreeProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    const ids = new Set<number>()
    const collect = (items: Category[]) => {
      items.forEach(cat => {
        if (cat.children && cat.children.length > 0) {
          ids.add(cat.id)
          collect(cat.children)
        }
      })
    }
    collect(categories)
    setExpanded(ids)
  }, [categories])

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div>
      {categories.map((cat: Category) => (
        <div key={cat.id}>
          <div
            className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer group text-sm ${selectedId === cat.id ? 'bg-zinc-200 dark:bg-zinc-700' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'} ${draggingCategoryId === cat.id ? 'opacity-50' : ''}`}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            draggable={editingId !== cat.id}
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(cat.id))
              onDragStartCategory(cat)
            }}
            onDragOver={e => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={e => {
              e.preventDefault()
              onDropCategory(cat)
            }}
            onDragEnd={() => onDragEndCategory()}
          >
            <button onClick={() => toggle(cat.id)} className="shrink-0">
              {cat.children && cat.children.length > 0
                ? (expanded.has(cat.id) ? <FolderOpen size={14} className="text-amber-500" /> : <Folder size={14} className="text-amber-500" />)
                : <Folder size={14} className="text-amber-500 opacity-70" />}
            </button>
            {editingId === cat.id ? (
              <div className="flex gap-1 flex-1">
                <input value={editingName} onChange={e => onEditingNameChange(e.target.value)} className="flex-1 text-xs border rounded px-1 py-0.5 bg-white dark:bg-zinc-900" autoFocus onKeyDown={e => { if (e.key === 'Enter') onEditConfirm(cat); if (e.key === 'Escape') onEditCancel() }} />
                <button onClick={() => onEditConfirm(cat)} className="text-xs text-green-600">✓</button>
                <button onClick={onEditCancel} className="text-xs text-zinc-400">✕</button>
              </div>
            ) : (
              <>
                <button className="flex-1 text-left truncate text-xs" onClick={() => onSelect(cat)}>
                  <span className="inline-flex items-center gap-1">
                    <span className="truncate">{cat.name}</span>
                    {depth === 0 && cat.isServerManaged && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none ${
                          'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        服务器
                      </span>
                    )}
                    {cat.hasGitRepo && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        Git
                      </span>
                    )}
                  </span>
                </button>
                <div className="flex w-14 shrink-0 items-center justify-end gap-0.5 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto">
                  <button onClick={() => onAddChild(cat)} className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded" title="新增子分类">+</button>
                  {!cat.isServerManaged && (
                    <button onClick={() => onRename(cat)} className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded"><Edit size={10} /></button>
                  )}
                  <button onClick={() => onCoverEditCategory(cat)} className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded" title="设置封面">
                    <ImageIcon size={10} />
                  </button>
                  <button onClick={() => onDelete(cat)} className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded text-red-500"><Trash2 size={10} /></button>
                </div>
              </>
            )}
          </div>
          {addingChildParentId === cat.id && (
            <div className="pl-6 pr-2 pb-1">
              <div className="flex gap-1">
                <Input
                  value={childCategoryName}
                  onChange={e => onChildCategoryNameChange(e.target.value)}
                  placeholder="子分类名称"
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && onAddChildConfirm()}
                />
                <Button size="sm" className="h-7 px-2" onClick={onAddChildConfirm}>✓</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onAddChildCancel}>✕</Button>
              </div>
            </div>
          )}
          {expanded.has(cat.id) && cat.children && cat.children.length > 0 && (
            <CategoryTree
              categories={cat.children}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onAddChild={onAddChild}
              editingId={editingId}
              editingName={editingName}
              onEditingNameChange={onEditingNameChange}
              onEditConfirm={onEditConfirm}
              onEditCancel={onEditCancel}
              addingChildParentId={addingChildParentId}
              childCategoryName={childCategoryName}
              onChildCategoryNameChange={onChildCategoryNameChange}
              onAddChildConfirm={onAddChildConfirm}
              onAddChildCancel={onAddChildCancel}
              draggingCategoryId={draggingCategoryId}
              onDragStartCategory={onDragStartCategory}
              onCoverEditCategory={onCoverEditCategory}
              onDropCategory={onDropCategory}
              onDragEndCategory={onDragEndCategory}
              serverManagedBranch={serverManagedBranch || cat.isServerManaged === true}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function isServerManagedBranch(target: Category, categories: Category[]): boolean {
  const parentMap = new Map<number, Category | null>()
  const build = (items: Category[], parent: Category | null) => {
    items.forEach(cat => {
      parentMap.set(cat.id, parent)
      if (cat.children?.length) build(cat.children, cat)
    })
  }
  build(categories, null)

  let current: Category | null | undefined = target
  while (current) {
    if (current.isServerManaged) return true
    current = parentMap.get(current.id) ?? null
  }
  return false
}
