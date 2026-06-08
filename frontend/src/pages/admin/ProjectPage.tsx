import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { api } from '../../api'
import type { Project } from '../../types'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { toast } from 'sonner'

export function ProjectPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [name, setName] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.getProjects().then(setProjects).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setShortDesc('')
    setDescription('')
    setLink('')
    setCoverImage('')
    setCoverFile(null)
    setEditOpen(true)
  }

  const openEdit = (p: Project) => {
    setEditing(p)
    setName(p.name)
    setShortDesc(p.shortDesc || '')
    setDescription(p.description || '')
    setLink(p.link || '')
    setCoverImage(p.coverImage || '')
    setCoverFile(null)
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('项目名称不能为空'); return }
    setSaving(true)
    try {
      let cover = coverImage
      if (coverFile) {
        const result = await api.uploadFile(coverFile)
        cover = result.url
      }
      const data = { name: name.trim(), shortDesc: shortDesc.trim(), description: description.trim(), link: link.trim(), coverImage: cover || null }
      if (editing) {
        await api.updateProject(editing.id, data)
        toast.success('更新成功')
      } else {
        await api.createProject(data)
        toast.success('创建成功')
      }
      setEditOpen(false)
      load()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此项目？')) return
    try {
      await api.deleteProject(id)
      toast.success('删除成功')
      load()
    } catch { toast.error('删除失败') }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">项目管理</h1>
        <Button onClick={openCreate}><Plus size={14} className="mr-1" />添加项目</Button>
      </div>

      {loading ? (
        <div className="text-zinc-400 py-12 text-center">加载中...</div>
      ) : projects.length === 0 ? (
        <div className="text-zinc-400 py-12 text-center">暂无项目，点击上方按钮添加</div>
      ) : (
        <div className="space-y-4">
          {projects.map((p, i) => (
            <div key={p.id} className="flex items-start gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                {p.coverImage ? (
                  <img src={p.coverImage} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={24} className="text-zinc-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{p.name}</h3>
                  <span className="text-xs text-zinc-400">#{i + 1}</span>
                </div>
                {p.shortDesc && <p className="text-sm text-zinc-500 mt-0.5 truncate">{p.shortDesc}</p>}
                {p.link && (
                  <a href={p.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-500 mt-1 hover:underline">
                    <ExternalLink size={12} />{p.link}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}><Edit size={14} /></Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(p.id)}><Trash2 size={14} className="text-red-500" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑项目' : '添加项目'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">项目名称 *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="我的项目" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">项目简述</label>
              <Input value={shortDesc} onChange={e => setShortDesc(e.target.value)} placeholder="简短描述" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">项目描述</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="详细描述项目内容..."
                className="w-full min-h-[100px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">链接</label>
              <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://github.com/..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">项目图片</label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) { setCoverFile(file); setCoverImage('') }
                  }}
                  className="text-sm"
                />
                {coverFile && <span className="text-xs text-zinc-500 truncate max-w-[120px]">{coverFile.name}</span>}
              </div>
              {coverImage && !coverFile && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={coverImage} alt="" className="w-12 h-12 rounded object-cover" />
                  <span className="text-xs text-zinc-500 truncate">{coverImage}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
