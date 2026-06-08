export interface Category {
  id: number
  name: string
  parentId: number | null
  coverImage: string | null
  sortOrder: number
  isServerManaged: boolean
  hasGitRepo?: boolean
  children?: Category[]
}

export interface Article {
  id: number
  title: string
  content: string
  categoryId: number
  filePath?: string | null
  category?: Category
  viewCount: number
  isRecommended: boolean
  isServerManaged: boolean
  createdAt: string
  updatedAt: string
}

export interface SystemSetting {
  id: number
  settingKey: string
  settingValue: string
  settingType: string
}

export interface ViewStats {
  totalViews: number
  totalVisits: number
  dailyViews: Array<{ date: string; count: number }>
  dailyVisits: Array<{ date: string; count: number }>
  topArticles: Array<{ article: Article; viewCount: number }>
}

export interface LoginResponse {
  token: string
  expiresAt: string
}

export interface Project {
  id: number
  name: string
  shortDesc: string
  description: string
  link: string
  coverImage: string | null
  sortOrder: number
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}
