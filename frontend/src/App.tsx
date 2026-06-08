import { createBrowserRouter, RouterProvider, Navigate, ScrollRestoration, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { Helmet, HelmetProvider } from 'react-helmet-async'
import { ThemeProvider } from './theme-provider'
import { Toaster } from './components/ui/sonner'
import { Navbar } from './components/Navbar'
import { SiteFooter } from './components/SiteFooter'
import { api } from './api'
import { SITE_CONFIG } from './config/site'
import { WelcomePage, loader as homeLoader } from './pages/WelcomePage'
import { CategoryPage, loader as categoryLoader } from './pages/CategoryPage'
import { ArticlePage } from './pages/ArticlePage'
import { SearchPage, loader as searchLoader } from './pages/SearchPage'
import { RecentPage, loader as recentLoader } from './pages/RecentPage.tsx'
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
  const visitRecordedRef = useRef(false)
  const location = useLocation()

  useEffect(() => {
    if (visitRecordedRef.current) return
    visitRecordedRef.current = true
    api.recordVisit().catch(() => {})
  }, [])

  useEffect(() => {
    const normalizeTitle = () => {
      const title = document.title.trim()
      const hostTitles = new Set([
        window.location.host,
        window.location.hostname,
        window.location.href,
      ])
      if (!title || hostTitles.has(title)) {
        document.title = location.pathname === '/' ? `首页 - ${SITE_CONFIG.name}` : SITE_CONFIG.name
      }
    }

    normalizeTitle()
    const titleElement = document.querySelector('title')
    if (!titleElement) return

    const observer = new MutationObserver(normalizeTitle)
    observer.observe(titleElement, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [location.pathname])

  return (
    <>
      <Helmet>
        <title>{SITE_CONFIG.name}</title>
        <meta name="description" content={SITE_CONFIG.description} />
      </Helmet>
      <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col">
        <Navbar />
        <ScrollRestoration getKey={(location) => {
          if (sessionStorage.getItem('scrollToProjects') === '1' || sessionStorage.getItem('scrollToAbout') === '1') {
            return 'scroll-target-' + Date.now()
          }
          return location.key
        }} />
        <main className="flex-1"><Outlet /></main>
        <SiteFooter />
      </div>
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, loader: homeLoader, element: <WelcomePage /> },
      { path: 'categories', loader: categoryLoader, element: <CategoryPage /> },
      { path: 'categories/:id', loader: categoryLoader, element: <CategoryPage /> },
      { path: 'articles/view', element: <ArticlePage /> },
      { path: 'articles/:id', element: <ArticlePage /> },
      { path: 'search', loader: searchLoader, element: <SearchPage /> },
      { path: 'recent', loader: recentLoader, element: <RecentPage /> },
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
    <HelmetProvider>
      <ThemeProvider>
        <Toaster richColors position="top-center" />
        <RouterProvider router={router} />
      </ThemeProvider>
    </HelmetProvider>
  )
}

export default App
