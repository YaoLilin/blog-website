import { useEffect } from 'react'
import { Link, Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { LayoutDashboard, FileText, BarChart2, Settings, GitBranch, LogOut, Workflow, User } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { isTokenExpired } from '../../lib/jwt'
import { toast } from 'sonner'
import { cn } from '../../lib/utils'

const menuItems = [
  { path: '/admin', icon: LayoutDashboard, label: '概览', exact: true },
  { path: '/admin/articles', icon: FileText, label: '文章管理' },
  { path: '/admin/stats', icon: BarChart2, label: '统计' },
  { path: '/admin/git', icon: GitBranch, label: 'Git 同步' },
  { path: '/admin/projects', icon: Workflow, label: '项目' },
  { path: '/admin/profile', icon: User, label: '个人介绍' },
  { path: '/admin/settings', icon: Settings, label: '设置' },
]

export function AdminLayout() {
  const { isAdmin, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    document.title = '后台管理'
  }, [])

  if (!isAdmin || isTokenExpired()) {
    if (isAdmin && isTokenExpired()) {
      logout()
      toast.error('登录已过期，请重新登录')
    }
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* 左侧导航 */}
      <aside className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <Link to="/" className="text-sm font-bold hover:opacity-80">← 返回博客</Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {menuItems.map(item => {
            const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => { logout(); navigate('/admin/login', { replace: true }) }}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <LogOut size={14} />退出登录
          </button>
        </div>
      </aside>

      {/* 右侧内容 */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
