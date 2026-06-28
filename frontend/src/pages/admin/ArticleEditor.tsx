import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { api } from '../../api'
import type { Article } from '../../types'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { VditorEditor } from '../../components/VditorEditor'

interface Props {
  article?: Article
  categoryId?: number
  onSave: (article: Article) => void
}

export function ArticleEditor({ article, categoryId, onSave }: Props) {
  const [title, setTitle] = useState(article?.title || '')
  const [content, setContent] = useState(article?.content || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(article?.title || '')
    setContent(article?.content || '')
  }, [article])

  const handleSave = async () => {
    if (!title.trim()) { alert('请输入标题'); return }
    setSaving(true)
    try {
      let saved: Article
      if (article) {
        saved = await api.updateArticle(article.id, {
          title,
          content,
          categoryId: article.categoryId,
          filePath: article.filePath,
          isServerManaged: article.isServerManaged,
          isRecommended: article.isRecommended,
        })
      } else {
        saved = await api.createArticle({ title, content, categoryId })
      }
      onSave(saved)
    } catch {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="文章标题" className="flex-1 max-w-sm" />
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save size={14} className="mr-1" />{saving ? '保存中...' : '保存'}
        </Button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0 rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
        <VditorEditor
          value={content}
          onChange={setContent}
          articleId={article?.id}
          placeholder="Markdown 内容... 可直接粘贴图片或文件"
          minHeight={600}
          className="h-full"
        />
      </div>
    </div>
  )
}
