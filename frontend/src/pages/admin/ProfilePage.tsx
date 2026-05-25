import { useEffect, useState, useRef } from 'react'
import { api } from '../../api'
import { Button } from '../../components/ui/button'
import { VditorEditor } from '../../components/VditorEditor'
import { toast } from 'sonner'
import { Upload, Save } from 'lucide-react'

export function ProfilePage() {
  const [image, setImage] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getProfile().then(data => {
      setImage(data.image || '')
      setContent(data.content || '')
    }).catch(() => toast.error('加载个人介绍失败'))
    .finally(() => setLoading(false))
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImage(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let imageUrl = image
      if (imageFile) {
        const result = await api.uploadFile(imageFile)
        imageUrl = result.url
        setImage(imageUrl)
        setImageFile(null)
      }
      await api.updateProfile({ image: imageUrl || '', content })
      toast.success('保存成功')
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-zinc-400 text-center">加载中...</div>
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold mb-6">个人介绍</h1>

      <div className="space-y-8">
        {/* 图片 */}
        <div>
          <label className="block text-sm font-medium mb-3">图片</label>
          <div className="flex items-start gap-6">
            <div className="shrink-0">
              {image ? (
                <img
                  src={image}
                  alt="个人图片"
                  className="w-36 h-36 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700"
                />
              ) : (
                <div className="w-36 h-36 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 text-sm">
                  无图片
                </div>
              )}
            </div>
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} className="mr-1" />
                上传图片
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </div>
        </div>

        {/* 个人介绍内容 */}
        <div>
          <label className="block text-sm font-medium mb-3">个人介绍</label>
          <VditorEditor
            value={content}
            onChange={setContent}
            placeholder="编写个人介绍内容..."
            minHeight={400}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save size={14} className="mr-1" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}
