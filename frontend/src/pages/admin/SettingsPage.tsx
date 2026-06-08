import { useEffect, useState } from 'react'
import { api } from '../../api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import type { Category } from '../../types'
import type { Article } from '../../types'
import { toast } from 'sonner'
import { formatCategoryPath } from '../../lib/category'

export function SettingsPage() {
  const [motto, setMotto] = useState('')
  const [storageLocation, setStorageLocation] = useState('CURRENT_FOLDER')
  const [customPath, setCustomPath] = useState('')
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [recommendedCategoryIds, setRecommendedCategoryIds] = useState<number[]>([])
  const [recommendedArticleIds, setRecommendedArticleIds] = useState<number[]>([])
  const [recommendedArticles, setRecommendedArticles] = useState<Article[]>([])
  const [articleSearchKeyword, setArticleSearchKeyword] = useState('')
  const [articleSearchResults, setArticleSearchResults] = useState<Article[]>([])
  const [articleSearchLoading, setArticleSearchLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    api.getSettings().then(async s => {
      if (s.MOTTO) setMotto(s.MOTTO)
      if (s.ATTACHMENT_STORAGE_LOCATION) setStorageLocation(s.ATTACHMENT_STORAGE_LOCATION)
      if (s.ATTACHMENT_CUSTOM_PATH) setCustomPath(s.ATTACHMENT_CUSTOM_PATH)
      if (s.HOME_RECOMMENDED_CATEGORY_IDS) {
        setRecommendedCategoryIds(
          s.HOME_RECOMMENDED_CATEGORY_IDS.split(',')
            .map(id => Number(id.trim()))
            .filter(id => Number.isFinite(id)),
        )
      }
      if (s.HOME_RECOMMENDED_ARTICLE_IDS) {
        const ids = s.HOME_RECOMMENDED_ARTICLE_IDS.split(',')
          .map(id => Number(id.trim()))
          .filter(id => Number.isFinite(id))
        setRecommendedArticleIds(ids)
        if (ids.length > 0) {
          const articles = await Promise.all(
            ids.map(async id => {
              try {
                return await api.getArticle(id)
              } catch {
                return null
              }
            }),
          )
          setRecommendedArticles(articles.filter((a): a is Article => !!a))
        }
      }
    }).catch(() => {})
    api.getCategoryTree().then(setAllCategories).catch(() => {})
  }, [])

  const searchArticles = async () => {
    const keyword = articleSearchKeyword.trim()
    if (!keyword) {
      setArticleSearchResults([])
      return
    }
    setArticleSearchLoading(true)
    try {
      const results = await api.searchArticles(keyword, true)
      setArticleSearchResults(results)
    } catch {
      setArticleSearchResults([])
      toast.error('搜索失败')
    } finally {
      setArticleSearchLoading(false)
    }
  }

  const addRecommendedArticle = (article: Article) => {
    if (recommendedArticleIds.includes(article.id)) return
    if (recommendedArticleIds.length >= 30) {
      toast.error('推荐文章最多 30 条')
      return
    }
    setRecommendedArticleIds(prev => [...prev, article.id])
    setRecommendedArticles(prev => [...prev, article])
  }

  const removeRecommendedArticle = (articleId: number) => {
    setRecommendedArticleIds(prev => prev.filter(id => id !== articleId))
    setRecommendedArticles(prev => prev.filter(article => article.id !== articleId))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        api.updateMotto(motto),
        api.updateSetting('ATTACHMENT_STORAGE_LOCATION', storageLocation),
        storageLocation === 'SUBFOLDER' || storageLocation === 'CUSTOM_PATH'
          ? api.updateSetting('ATTACHMENT_CUSTOM_PATH', customPath)
          : Promise.resolve(),
        api.updateSetting('HOME_RECOMMENDED_CATEGORY_IDS', recommendedCategoryIds.join(',')),
        api.updateSetting('HOME_RECOMMENDED_ARTICLE_IDS', recommendedArticleIds.join(',')),
      ])
      setSavedMsg('保存成功')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">系统设置</h1>

      <div className="space-y-6">
        {/* 座右铭 */}
        <div>
          <label className="block text-sm font-medium mb-2">首页座右铭</label>
          <Input value={motto} onChange={e => setMotto(e.target.value)} placeholder="请输入座右铭" />
          <p className="text-xs text-zinc-400 mt-1">显示在首页顶部的格言</p>
        </div>

        {/* 首页推荐分类 */}
        <div>
          <label className="block text-sm font-medium mb-2">首页推荐分类</label>
          <p className="text-xs text-zinc-400 mb-3">可选择任意层级分类。首页没设置时，默认取前 5 个根分类。</p>
          {allCategories.length > 0 ? (
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <CategoryTreeSelector
                categories={allCategories}
                selectedIds={recommendedCategoryIds}
                onToggle={id => {
                  setRecommendedCategoryIds(prev =>
                    prev.includes(id)
                      ? prev.filter(v => v !== id)
                      : [...prev, id],
                  )
                }}
              />
            </div>
          ) : (
            <p className="text-xs text-zinc-400">暂无根分类</p>
          )}
        </div>

        {/* 首页推荐文章 */}
        <div>
          <label className="block text-sm font-medium mb-2">首页推荐文章</label>
          <p className="text-xs text-zinc-400 mb-3">可搜索文章后加入列表，最多 30 条。</p>
          <div className="flex gap-2 mb-3">
            <Input
              value={articleSearchKeyword}
              onChange={e => setArticleSearchKeyword(e.target.value)}
              placeholder="搜索文章标题"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void searchArticles()
                }
              }}
            />
            <Button type="button" variant="outline" onClick={() => void searchArticles()} disabled={articleSearchLoading}>
              {articleSearchLoading ? '搜索中...' : '搜索'}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-2 text-sm font-medium">已选文章（{recommendedArticleIds.length}/30）</div>
              <div className="space-y-2">
                {recommendedArticles.map(article => (
                  <div key={article.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{article.title}</p>
                      {article.category && (
                        <p className="truncate text-xs text-zinc-400">
                          {formatCategoryPath(allCategories, article.category.id) || article.category.name}
                        </p>
                      )}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => removeRecommendedArticle(article.id)}>
                      移除
                    </Button>
                  </div>
                ))}
                {recommendedArticles.length === 0 && (
                  <div className="py-8 text-center text-sm text-zinc-400">暂无推荐文章</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-2 text-sm font-medium">搜索结果</div>
              <div className="space-y-2">
                {articleSearchResults.map(article => {
                  const selected = recommendedArticleIds.includes(article.id)
                  return (
                    <div key={article.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{article.title}</p>
                        {article.category && (
                          <p className="truncate text-xs text-zinc-400">
                            {formatCategoryPath(allCategories, article.category.id) || article.category.name}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={selected ? 'outline' : 'default'}
                        disabled={selected}
                        onClick={() => addRecommendedArticle(article)}
                      >
                        {selected ? '已选' : '添加'}
                      </Button>
                    </div>
                  )
                })}
                {articleSearchResults.length === 0 && (
                  <div className="py-8 text-center text-sm text-zinc-400">暂无结果</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 附件存储位置 */}
        <div>
          <label className="block text-sm font-medium mb-2">附件存储位置（服务器文件适用）</label>
          <div className="space-y-2">
            {[
              { value: 'ROOT', label: '根目录' },
              { value: 'CURRENT_FOLDER', label: '当前文件夹' },
              { value: 'SUBFOLDER', label: '当前文件夹指定子文件夹' },
              { value: 'CUSTOM_PATH', label: '指定路径' },
            ].map(opt => (
              <div key={opt.value} className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="storageLocation" value={opt.value} checked={storageLocation === opt.value} onChange={e => setStorageLocation(e.target.value)} className="accent-zinc-700 dark:accent-zinc-300" />
                  <span className="text-sm">{opt.label}</span>
                </label>
                {storageLocation === opt.value && (opt.value === 'SUBFOLDER' || opt.value === 'CUSTOM_PATH') && (
                  <div className="pl-6">
                    <Input
                      value={customPath}
                      onChange={e => setCustomPath(e.target.value)}
                      placeholder="file/images"
                    />
                    <p className="mt-1 text-xs text-zinc-400">
                      可输入子文件夹名称或路径。输入的是路径时，表示当前文件夹下的相对路径。
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存设置'}</Button>
          {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
        </div>
      </div>
    </div>
  )
}

function CategoryTreeSelector({
  categories,
  selectedIds,
  onToggle,
  depth = 0,
}: {
  categories: Category[]
  selectedIds: number[]
  onToggle: (id: number) => void
  depth?: number
}) {
  return (
    <div className="space-y-1">
      {categories.map(cat => {
        const selected = selectedIds.includes(cat.id)
        return (
          <div key={cat.id}>
            <label
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${
                'hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
              style={{ paddingLeft: `${depth * 18 + 8}px` }}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(cat.id)}
                className="accent-zinc-700 dark:accent-zinc-300"
              />
              <span className="truncate">{cat.name}</span>
              {selected && (
                <span className="ml-auto text-[11px] text-blue-600">已选</span>
              )}
            </label>
            {cat.children?.length ? (
              <div className="space-y-1">
                <CategoryTreeSelector
                  categories={cat.children}
                  selectedIds={selectedIds}
                  onToggle={onToggle}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
