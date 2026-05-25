import type { Category } from '../types'

export function findCategoryPath(tree: Category[], targetId?: number | null): Category[] {
  if (targetId == null) return []
  const walk = (items: Category[], path: Category[]): Category[] | null => {
    for (const cat of items) {
      const nextPath = [...path, cat]
      if (cat.id === targetId) return nextPath
      if (cat.children?.length) {
        const found = walk(cat.children, nextPath)
        if (found) return found
      }
    }
    return null
  }
  return walk(tree, []) || []
}

export function formatCategoryPath(tree: Category[], targetId?: number | null): string {
  return findCategoryPath(tree, targetId).map(cat => cat.name).join(' / ')
}
