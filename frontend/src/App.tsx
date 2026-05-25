import { createBrowserRouter, RouterProvider, Navigate, ScrollRestoration, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { ThemeProvider } from './theme-provider'
import { Toaster } from './components/ui/sonner'
import { Navbar } from './components/Navbar'
import { api } from './api'
import { WelcomePage, loader as homeLoader } from './pages/WelcomePage'
import { CategoryPage } from './pages/CategoryPage'
import { ArticlePage } from './pages/ArticlePage'
import { SearchPage } from './pages/SearchPage'
import { RecentPage } from './pages/RecentPage.tsx'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { ArticleManagement } from './pages/admin/ArticleManagement'
import { StatsPage } from './pages/admin/StatsPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { GitPage } from './pages/admin/GitPage'
import { ProjectPage } from './pages/admin/ProjectPage'
import { ProfilePage } from './pages/admin/ProfilePage'

function PublicLayout() {
  const location = useLocation()
  const visitRecordedRef = useRef(false)

  useEffect(() => {
    const blogName = localStorage.getItem('blogName') || ''
    if (location.pathname === '/articles/view' || location.pathname.startsWith('/articles/')) {
      return
    }
    document.title = blogName
  }, [location.pathname])

  useEffect(() => {
    if (visitRecordedRef.current) return
    visitRecordedRef.current = true
    api.recordVisit().catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <Navbar />
      <ScrollRestoration getKey={(location) => {
        if (sessionStorage.getItem('scrollToProjects') === '1' || sessionStorage.getItem('scrollToAbout') === '1') {
          return 'scroll-target-' + Date.now()
        }
        return location.key
      }} />
      <div><Outlet /></div>
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, loader: homeLoader, element: <WelcomePage /> },
      { path: 'categories', element: <CategoryPage /> },
      { path: 'categories/:id', element: <CategoryPage /> },
      { path: 'articles/view', element: <ArticlePage /> },
      { path: 'articles/:id', element: <ArticlePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'recent', element: <RecentPage /> },
      { path: 'about', element: <Navigate to="/" replace /> },
    ],
  },
  { path: '/admin/login', element: <AdminLoginPage /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'articles', element: <ArticleManagement /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'git', element: <GitPage /> },
      { path: 'projects', element: <ProjectPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

function App() {
  return (
    <ThemeProvider>
      <Toaster richColors position="top-center" />
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

export default App
