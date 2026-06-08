import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Eye, GitBranch, AlertCircle, Activity } from 'lucide-react'
import { api } from '../../api'
import type { ViewStats } from '../../types'

export function AdminDashboard() {
  const [stats, setStats] = useState<ViewStats | null>(null)
  const [gitStatus, setGitStatus] = useState<{ hasRepo: boolean; hasUncommittedChanges?: boolean } | null>(null)

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {})

    api.getCategoryTree().then(cats => {
      const findManaged = (list: any[]): number | null => {
        for (const c of list) {
          if (c.isServerManaged) return c.id
          if (c.children?.length) {
            const found = findManaged(c.children)
            if (found != null) return found
          }
        }
        return null
      }
      const catId = findManaged(cats)
      if (catId != null) {
        return api.getGitStatus(catId).then(setGitStatus).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-6">后台管理</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/admin/articles" className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-colors">
          <FileText size={24} className="mb-3 text-zinc-500" />
          <p className="font-medium">文章管理</p>
          <p className="text-sm text-zinc-400 mt-1">管理所有博客文章</p>
        </Link>
        <Link to="/admin/stats" className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-colors">
          <div className="flex gap-4">
            <div>
              <Eye size={24} className="mb-3 text-zinc-500" />
              <p className="font-medium">总阅读数</p>
              <p className="text-2xl font-bold mt-1">{stats?.totalViews ?? '--'}</p>
            </div>
            <div>
              <Activity size={24} className="mb-3 text-zinc-500" />
              <p className="font-medium">网站访问</p>
              <p className="text-2xl font-bold mt-1">{stats?.totalVisits ?? '--'}</p>
            </div>
          </div>
        </Link>
        <Link to="/admin/git" className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-colors">
          <GitBranch size={24} className="mb-3 text-zinc-500" />
          <p className="font-medium">Git 同步</p>
          {gitStatus?.hasRepo && gitStatus.hasUncommittedChanges && (
            <p className="text-sm text-amber-500 mt-1 flex items-center gap-1"><AlertCircle size={12} />有未提交的更改</p>
          )}
          {gitStatus?.hasRepo && !gitStatus.hasUncommittedChanges && (
            <p className="text-sm text-green-500 mt-1">已是最新状态</p>
          )}
          {gitStatus && !gitStatus.hasRepo && (
            <p className="text-sm text-zinc-400 mt-1">未检测到 Git 仓库</p>
          )}
        </Link>
      </div>
    </div>
  )
}
