import { toast } from 'sonner'

const BASE_URL = '/api'

type ApiRequestOptions = RequestInit & {
  redirectOnUnauthorized?: boolean
}

const getHeaders = () => {
  const token = localStorage.getItem('auth_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function handleAuthExpired() {
  localStorage.removeItem('auth_token')
  // 清除 Zustand 持久化数据
  try { localStorage.removeItem('auth-store') } catch {}
  toast.error('登录已过期，请重新登录')
  window.location.href = '/admin/login'
}

function isHtmlResponse(text: string, contentType: string | null) {
  if (contentType?.toLowerCase().includes('text/html')) {
    return true
  }
  const normalized = text.trim().toLowerCase()
  return normalized.startsWith('<!doctype html') || normalized.startsWith('<html')
}

function normalizeErrorMessage(resp: Response, text: string, parsedBody?: unknown) {
  if (parsedBody && typeof parsedBody === 'object' && 'error' in parsedBody && parsedBody.error) {
    return String((parsedBody as { error: unknown }).error)
  }

  if (resp.status === 408 || resp.status === 504) {
    return '请求超时，请稍后重试'
  }

  if (isHtmlResponse(text, resp.headers.get('content-type'))) {
    const lowered = text.toLowerCase()
    if (lowered.includes('gateway time-out') || lowered.includes('gateway timeout') || lowered.includes('time-out')) {
      return '请求超时，请稍后重试'
    }
    return `请求失败（HTTP ${resp.status}）`
  }

  return text || `HTTP ${resp.status}`
}

async function request<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
  const { redirectOnUnauthorized = true, ...fetchOptions } = options || {}
  let resp: Response
  try {
    resp = await fetch(`${BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers: { ...getHeaders(), ...(fetchOptions.headers || {}) },
    })
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? '请求超时，请稍后重试'
      : '网络请求失败，请稍后重试'
    throw new Error(message)
  }
  const text = await resp.text()
  if (!resp.ok) {
    if (resp.status === 401 && redirectOnUnauthorized) {
      handleAuthExpired()
      throw new Error('登录已过期')
    }
    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(text)
    } catch {}
    const message = normalizeErrorMessage(resp, text, parsedBody)
    const error = new Error(message) as Error & { data?: unknown }
    error.data = parsedBody
    throw error
  }
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  // Auth
  login: (password: string) =>
    request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      redirectOnUnauthorized: false,
    }),

  // Categories
  getCategories: () => request<import('../types').Category[]>('/categories'),
  getCategoryTree: () => request<import('../types').Category[]>('/categories/tree'),
  getHomeCategories: () => request<import('../types').Category[]>('/categories/home'),
  createCategory: (data: Partial<import('../types').Category>) =>
    request<import('../types').Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: number, data: Partial<import('../types').Category>) =>
    request<import('../types').Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: number) =>
    request<void>(`/categories/${id}`, { method: 'DELETE' }),
  moveCategory: (id: number, newParentId: number | null) =>
    request<void>(`/categories/${id}/move`, { method: 'POST', body: JSON.stringify({ newParentId }) }),

  // Articles
  getArticles: (params?: { categoryId?: number; page?: number; size?: number }) => {
    const q = new URLSearchParams()
    if (params?.categoryId) q.set('categoryId', String(params.categoryId))
    if (params?.page !== undefined) q.set('page', String(params.page))
    if (params?.size !== undefined) q.set('size', String(params.size))
    return request<{ content: import('../types').Article[]; totalElements: number }>(`/articles?${q}`)
  },
  getArticle: (id: number) => request<import('../types').Article>(`/articles/${id}`),
  getArticleByPath: (path: string) =>
    request<import('../types').Article>(`/articles/by-path?path=${encodeURIComponent(path)}`),
  getRecommendedArticles: () => request<import('../types').Article[]>('/articles/recommended'),
  getRecentArticles: (limit = 10) => request<import('../types').Article[]>(`/articles/recent?limit=${limit}`),
  searchArticles: (keyword: string, titleOnly = false) =>
    request<import('../types').Article[]>(
      `/articles/search?keyword=${encodeURIComponent(keyword)}&titleOnly=${titleOnly}`,
    ),
  createArticle: (data: Partial<import('../types').Article>) =>
    request<import('../types').Article>('/articles', { method: 'POST', body: JSON.stringify(data) }),
  updateArticle: (id: number, data: Partial<import('../types').Article>) =>
    request<import('../types').Article>(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArticle: (id: number) =>
    request<void>(`/articles/${id}`, { method: 'DELETE' }),
  recordView: (id: number) =>
    request<void>(`/articles/${id}/view`, { method: 'POST' }),
  getArticleGitRemote: (id: number) =>
    request<{ url: string }>(`/articles/${id}/git-remote`),

  // Settings
  getMotto: () => request<{ motto: string }>('/settings/motto'),
  updateMotto: (motto: string) =>
    request<void>('/settings/motto', { method: 'PUT', body: JSON.stringify({ motto }) }),
  getSettings: () => request<Record<string, string>>('/settings'),
  updateSetting: (key: string, value: string) =>
    request<void>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),

  // Stats
  getStats: () => request<import('../types').ViewStats>('/stats'),
  recordVisit: () => request<void>('/stats/visit', { method: 'POST' }),

  // Profile
  getProfile: () =>
    request<{ image: string; content: string; motto: string }>('/settings/profile'),
  updateProfile: (data: { image?: string; content?: string }) =>
    request<void>('/settings/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Upload
  uploadFile: (file: File, articleId?: number) => {
    const form = new FormData()
    form.append('file', file)
    if (articleId) form.append('articleId', String(articleId))
    const token = localStorage.getItem('auth_token')
    return fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async r => {
      const text = await r.text()
      if (!r.ok) {
        if (r.status === 401) {
          handleAuthExpired()
          throw new Error('登录已过期')
        }
        let parsedBody: unknown
        try {
          parsedBody = JSON.parse(text)
        } catch {}
        throw new Error(normalizeErrorMessage(r, text, parsedBody))
      }
      return (text ? JSON.parse(text) : undefined) as { url: string; originalName: string }
    }).catch(err => {
      if (err instanceof Error) {
        throw err
      }
      throw new Error('网络请求失败，请稍后重试')
    })
  },

  // Git
  getGitStatus: (categoryId?: number | null) => {
    const q = categoryId == null ? '' : `?categoryId=${categoryId}`
    return request<{ hasRepo: boolean; currentBranch?: string; hasUncommittedChanges?: boolean; uncommittedFiles?: string[]; remoteUrls?: string[] }>(`/git/status${q}`)
  },
  gitCommit: (message: string, categoryId?: number | null) =>
    request<void>('/git/commit', { method: 'POST', body: JSON.stringify({ message, categoryId }) }),
  gitPush: (remoteName: string, username: string, password: string, categoryId?: number | null) =>
    request<void>('/git/push', { method: 'POST', body: JSON.stringify({ remoteName, username, password, categoryId }) }),
  gitPull: (remoteName: string, username: string, password: string, categoryId?: number | null, forceOverwrite = false) =>
    request<{ success: boolean; hasConflicts?: boolean }>('/git/pull', {
      method: 'POST',
      body: JSON.stringify({ remoteName, username, password, categoryId, forceOverwrite }),
    }),
  cloneRemoteRepo: (url: string, targetCategoryId: number | null, customPath?: string) =>
    request<{ directory: string; repoName: string; relativePath: string }>('/git/clone', {
      method: 'POST',
      body: JSON.stringify({
        url,
        targetCategoryId,
        ...(customPath ? { customPath } : {}),
      }),
    }),
  addRemote: (name: string, url: string, categoryId?: number | null) =>
    request<void>('/git/remote/add', { method: 'POST', body: JSON.stringify({ name, url, categoryId }) }),
  removeRemote: (name: string, categoryId?: number | null) => {
    const q = categoryId == null ? '' : `?categoryId=${categoryId}`
    return request<void>(`/git/remote/${name}${q}`, { method: 'DELETE' })
  },
  syncCategories: () => request<void>('/categories/sync', { method: 'POST' }),

  listRemotes: (categoryId?: number | null) => {
    const q = categoryId == null ? '' : `?categoryId=${categoryId}`
    return request<Array<{ name: string; urls: string[] }>>(`/git/remotes${q}`)
  },

  // Projects
  getProjects: () => request<import('../types').Project[]>('/projects'),
  createProject: (data: Partial<import('../types').Project>) =>
    request<import('../types').Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: number, data: Partial<import('../types').Project>) =>
    request<import('../types').Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: number) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
}
