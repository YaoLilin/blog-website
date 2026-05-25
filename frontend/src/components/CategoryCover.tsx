import {
  BookOpen,
  Briefcase,
  Camera,
  Code2,
  Database,
  FileText,
  Folder,
  GraduationCap,
  Globe,
  Image,
  LayoutGrid,
  MessageSquare,
  Palette,
  PenLine,
  Rocket,
  Server,
  Shield,
  Sparkles,
  Terminal,
} from 'lucide-react'

import { cn } from '../lib/utils'

const ICONS = {
  Folder,
  BookOpen,
  FileText,
  Code2,
  Image,
  Database,
  Server,
  GraduationCap,
  PenLine,
  Sparkles,
  Palette,
  Globe,
  LayoutGrid,
  Briefcase,
  Rocket,
  Camera,
  MessageSquare,
  Terminal,
  Shield,
} as const

const ICON_LABELS: Record<keyof typeof ICONS, string> = {
  Folder: '文件夹',
  BookOpen: '书本',
  FileText: '文档',
  Code2: '代码',
  Image: '图片',
  Database: '数据库',
  Server: '服务器',
  GraduationCap: '毕业帽',
  PenLine: '笔',
  Sparkles: '星光',
  Palette: '调色板',
  Globe: '地球',
  LayoutGrid: '网格',
  Briefcase: '公文包',
  Rocket: '火箭',
  Camera: '相机',
  MessageSquare: '对话框',
  Terminal: '终端',
  Shield: '盾牌',
}

export const CATEGORY_ICON_OPTIONS = Object.keys(ICONS).map(name => ({
  value: name as keyof typeof ICONS,
  label: ICON_LABELS[name as keyof typeof ICONS],
}))

function resolveIcon(name?: string | null) {
  if (!name) return Folder
  return ICONS[name as keyof typeof ICONS] || Folder
}

function isImageUrl(value: string) {
  return /^(https?:\/\/|\/|data:|blob:)/i.test(value)
}

export function getCategoryCoverKind(coverImage?: string | null) {
  if (!coverImage) return { kind: 'default' as const, value: '' }
  if (coverImage.startsWith('icon:')) {
    return { kind: 'icon' as const, value: coverImage.slice(5) }
  }
  if (isImageUrl(coverImage)) {
    return { kind: 'image' as const, value: coverImage }
  }
  return { kind: 'icon' as const, value: coverImage }
}

export function CategoryCover({
  coverImage,
  alt,
  className,
  iconClassName,
}: {
  coverImage?: string | null
  alt: string
  className?: string
  iconClassName?: string
}) {
  const cover = getCategoryCoverKind(coverImage)

  if (cover.kind === 'image') {
    return (
      <div className={cn('overflow-hidden bg-white dark:bg-zinc-950', className)}>
        <img src={cover.value} alt={alt} className="h-full w-full object-contain p-4" />
      </div>
    )
  }

  const Icon = resolveIcon(cover.value)
  return (
    <div className={cn('relative overflow-hidden bg-white dark:bg-zinc-950', className)}>
      <Icon className={cn('absolute left-3 top-3 text-zinc-300 dark:text-zinc-700', iconClassName)} />
    </div>
  )
}
