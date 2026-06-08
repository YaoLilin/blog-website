import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { api } from '../../api'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { SITE_CONFIG } from '../../config/site'

type LocationState = { from?: string }

export function AdminLoginPage() {
  const { isAdmin } = useAuthStore()

  useEffect(() => {
    document.title = '后台管理 - 登录'
  }, [])
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const from = state?.from || '/admin'
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (isAdmin) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await api.login(password)
      useAuthStore.getState().login(result.token)
      navigate(from, { replace: true })
    } catch {
      setError('密码错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>管理员登录 - {SITE_CONFIG.name}</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm text-zinc-500 mb-1">后台管理</p>
          <h1 className="text-2xl font-semibold">管理员登录</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">管理员密码</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入管理员密码"
              autoFocus
            />
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              返回博客首页
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
