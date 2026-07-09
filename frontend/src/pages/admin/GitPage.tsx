import { useEffect, useMemo, useState } from 'react'
import { GitCommit, GitPullRequest, Upload, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { api } from '../../api'
import { FeedbackDialog, type FeedbackDialogState } from '../../components/feedback-dialog'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import type { Category } from '../../types'

interface GitStatus {
  hasRepo: boolean
  currentBranch?: string
  hasUncommittedChanges?: boolean
  uncommittedFiles?: string[]
  remoteUrls?: string[]
}

interface PullConflictState {
  files: string[]
  message: string
}

interface PullResultState {
  title: string
  message: string
  variant: 'success' | 'error'
}

export function GitPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [remotes, setRemotes] = useState<Array<{ name: string; urls: string[] }>>([])
  const [loading, setLoading] = useState(false)
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [showPushDialog, setShowPushDialog] = useState(false)
  const [showPullDialog, setShowPullDialog] = useState(false)
  const [showAddRemoteDialog, setShowAddRemoteDialog] = useState(false)
  const [pullConflict, setPullConflict] = useState<PullConflictState | null>(null)
  const [pullResult, setPullResult] = useState<PullResultState | null>(null)
  const [commitMsg, setCommitMsg] = useState('')
  const [gitUser, setGitUser] = useState('')
  const [gitPass, setGitPass] = useState('')
  const [remoteName, setRemoteName] = useState('origin')
  const [newRemoteName, setNewRemoteName] = useState('')
  const [newRemoteUrl, setNewRemoteUrl] = useState('')
  const [pulling, setPulling] = useState(false)
  const [operationFeedback, setOperationFeedback] = useState<FeedbackDialogState | null>(null)

  const visibleCategories = useMemo(() => filterGitTree(categories), [categories])

  const repoLabel = useMemo(() => {
    if (selectedCategoryId == null) return '未选择仓库'
    const path = findCategoryPath(categories, selectedCategoryId)
    return path.length > 0 ? path.map(cat => cat.name).join(' / ') : '当前分类'
  }, [categories, selectedCategoryId])

  const refresh = (categoryId = selectedCategoryId) => {
    setLoading(true)
    Promise.all([
      api.getGitStatus(categoryId).then(setStatus),
      api.listRemotes(categoryId).then(setRemotes).catch(() => {}),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => {
    api.getCategoryTree().then(cats => {
      setCategories(cats)
      setSelectedCategoryId(prev => {
        if (prev != null && containsCategoryId(cats, prev)) return prev
        return findFirstRepoCategoryId(cats)
      })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    // selectedCategoryId changes should reload current repo state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId])

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setLoading(true)
    try {
      await api.gitCommit(commitMsg, selectedCategoryId)
      setCommitMsg('')
      setShowCommitDialog(false)
      refresh()
      setOperationFeedback({
        title: '提交成功',
        message: '已完成本地提交。',
        variant: 'success',
      })
    } catch (err) {
      setOperationFeedback({
        title: '提交失败',
        message: err instanceof Error ? err.message : '提交失败',
        variant: 'error',
      })
    } finally { setLoading(false) }
  }

  const handlePush = async () => {
    setLoading(true)
    try {
      await api.gitPush(remoteName, gitUser, gitPass, selectedCategoryId)
      setShowPushDialog(false)
      setGitUser(''); setGitPass('')
      setOperationFeedback({
        title: '推送成功',
        message: '已成功推送到远程仓库。',
        variant: 'success',
      })
    } catch (err) {
      setOperationFeedback({
        title: '推送失败',
        message: err instanceof Error ? err.message : '推送失败',
        variant: 'error',
      })
    } finally { setLoading(false) }
  }

  const handlePull = async () => {
    setPulling(true)
    try {
      const result = await api.gitPull(remoteName, gitUser, gitPass, selectedCategoryId)
      setShowPullDialog(false)
      setGitUser(''); setGitPass('')
      if (result.hasConflicts) {
        setPullResult({
          title: '拉取更新存在冲突',
          message: '拉取过程中发现合并冲突，请先处理冲突后再重试。',
          variant: 'error',
        })
      } else {
        setPullResult({
          title: '拉取成功',
          message: '已成功拉取远程更新。',
          variant: 'success',
        })
        refresh()
      }
    } catch (err) {
      const conflict = parsePullConflict(err)
      if (conflict) {
        setPullConflict(conflict)
        setShowPullDialog(false)
      } else {
        setPullResult({
          title: '拉取失败',
          message: err instanceof Error ? err.message : '拉取失败',
          variant: 'error',
        })
      }
    } finally { setPulling(false) }
  }

  const handleForcePull = async () => {
    setPulling(true)
    try {
      await api.gitPull(remoteName, gitUser, gitPass, selectedCategoryId, true)
      setPullConflict(null)
      setShowPullDialog(false)
      setGitUser('')
      setGitPass('')
      setPullResult({
        title: '覆盖并拉取成功',
        message: '已覆盖服务器中的冲突文件，并完成远程拉取。',
        variant: 'success',
      })
      refresh()
    } catch (err) {
      setPullResult({
        title: '覆盖并拉取失败',
        message: err instanceof Error ? err.message : '覆盖并拉取失败',
        variant: 'error',
      })
    } finally {
      setPulling(false)
    }
  }

  const handleAddRemote = async () => {
    if (!newRemoteName || !newRemoteUrl) return
    await api.addRemote(newRemoteName, newRemoteUrl, selectedCategoryId)
    setNewRemoteName(''); setNewRemoteUrl('')
    setShowAddRemoteDialog(false)
    refresh()
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Git 同步</h1>
        <Button variant="ghost" size="icon" onClick={() => refresh()} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></Button>
      </div>

      <div className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">当前仓库</h2>
          <span className="text-xs text-zinc-400">{repoLabel}</span>
        </div>
        <div className="max-h-56 overflow-y-auto rounded-md border border-zinc-100 dark:border-zinc-800 p-2">
          <RepoCategorySelector
            categories={visibleCategories}
            selectedId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
          />
        </div>
      </div>

      {status === null ? (
        <div className="text-zinc-400">加载中...</div>
      ) : !status.hasRepo ? (
        <div className="space-y-4">
          <p className="text-zinc-500">当前分类未检测到 Git 仓库</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 状态 */}
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm"><span className="text-zinc-500">当前分支：</span>{status.currentBranch}</p>
            <p className="text-sm mt-1">
              <span className="text-zinc-500">未提交变更：</span>
              {status.hasUncommittedChanges
                ? <span className="text-amber-500">{status.uncommittedFiles?.length} 个文件</span>
                : <span className="text-green-600">无</span>}
            </p>
            {status.uncommittedFiles && status.uncommittedFiles.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto">
                {status.uncommittedFiles.map(f => <p key={f} className="text-xs text-zinc-400">{f}</p>)}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCommitDialog(true)} disabled={!status.hasUncommittedChanges}>
              <GitCommit size={14} className="mr-1" />提交变更
            </Button>
            <Button variant="outline" onClick={() => setShowPullDialog(true)}>
              <GitPullRequest size={14} className="mr-1" />拉取更新
            </Button>
            <Button variant="outline" onClick={() => setShowPushDialog(true)}>
              <Upload size={14} className="mr-1" />推送到远程
            </Button>
          </div>

          {/* 远程仓库 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium">远程仓库</h2>
              <Button size="sm" variant="outline" onClick={() => setShowAddRemoteDialog(true)}><Plus size={12} className="mr-1" />添加</Button>
            </div>
            {remotes.length === 0 ? (
              <p className="text-sm text-zinc-400">暂无远程仓库</p>
            ) : (
              <div className="space-y-2">
                {remotes.map(r => (
                  <div key={r.name} className="flex items-center justify-between p-3 rounded border border-zinc-200 dark:border-zinc-700 text-sm">
                    <div>
                      <span className="font-medium">{r.name}</span>
                      <span className="text-zinc-400 ml-2 text-xs">{r.urls[0]}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => api.removeRemote(r.name, selectedCategoryId).then(() => refresh())}><Trash2 size={12} /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 提交对话框 */}
      <Dialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>提交变更</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={commitMsg} onChange={e => setCommitMsg(e.target.value)} placeholder="提交信息" autoFocus />
            <Button onClick={handleCommit} disabled={loading || !commitMsg.trim() || !status?.hasRepo} className="w-full">提交</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 推送对话框 */}
      <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>推送到远程</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={remoteName} onChange={e => setRemoteName(e.target.value)} placeholder="远程仓库名 (origin)" />
            <Input value={gitUser} onChange={e => setGitUser(e.target.value)} placeholder="用户名" />
            <Input type="password" value={gitPass} onChange={e => setGitPass(e.target.value)} placeholder="密码/Token" />
            <Button onClick={handlePush} disabled={loading || !status?.hasRepo} className="w-full">推送</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 拉取对话框 */}
      <Dialog open={showPullDialog} onOpenChange={setShowPullDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>拉取更新</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={remoteName} onChange={e => setRemoteName(e.target.value)} placeholder="远程仓库名 (origin)" />
            <Input value={gitUser} onChange={e => setGitUser(e.target.value)} placeholder="用户名" />
            <Input type="password" value={gitPass} onChange={e => setGitPass(e.target.value)} placeholder="密码/Token" />
            <Button onClick={handlePull} disabled={pulling || !status?.hasRepo} className="w-full">
              <RefreshCw size={14} className={`mr-1 ${pulling ? 'animate-spin' : ''}`} />
              {pulling ? '拉取中' : '拉取'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 添加远程仓库对话框 */}
      <Dialog open={showAddRemoteDialog} onOpenChange={setShowAddRemoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加远程仓库</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newRemoteName} onChange={e => setNewRemoteName(e.target.value)} placeholder="名称 (如 origin)" />
            <Input value={newRemoteUrl} onChange={e => setNewRemoteUrl(e.target.value)} placeholder="URL (如 https://github.com/...)" />
            <Button onClick={handleAddRemote} disabled={!newRemoteName || !newRemoteUrl || !status?.hasRepo} className="w-full">添加</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pullConflict !== null} onOpenChange={open => { if (!open) setPullConflict(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>拉取更新存在冲突</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              检测到服务器中的以下文件有本地改动，直接拉取会覆盖它们。
            </p>
            <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
              {pullConflict?.files.map(file => (
                <p key={file} className="text-sm text-zinc-500 dark:text-zinc-300">{file}</p>
              ))}
            </div>
            <p className="text-xs text-zinc-400">{pullConflict?.message}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPullConflict(null)}
                disabled={pulling}
              >
                我自己处理
              </Button>
              <Button
                className="flex-1"
                onClick={handleForcePull}
                disabled={pulling}
              >
                <RefreshCw size={14} className={`mr-1 ${pulling ? 'animate-spin' : ''}`} />
                {pulling ? '覆盖并拉取中' : '覆盖服务器中的文件'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pullResult !== null} onOpenChange={open => { if (!open) setPullResult(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pullResult?.title}</DialogTitle>
          </DialogHeader>
          <Alert variant={pullResult?.variant === 'error' ? 'destructive' : 'default'}>
            {pullResult?.variant === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <div className="min-w-0 space-y-1">
              <AlertTitle>{pullResult?.variant === 'error' ? '拉取未完成' : '拉取已完成'}</AlertTitle>
              <AlertDescription className="break-words whitespace-pre-wrap">{pullResult?.message}</AlertDescription>
            </div>
          </Alert>
          <DialogFooter>
            <Button onClick={() => setPullResult(null)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackDialog
        open={operationFeedback !== null}
        feedback={operationFeedback}
        onOpenChange={open => {
          if (!open) setOperationFeedback(null)
        }}
      />
    </div>
  )
}

function parsePullConflict(err: unknown): PullConflictState | null {
  if (!(err instanceof Error)) return null
  const payload = (err as Error & { data?: unknown }).data
  try {
    const parsed = (payload && typeof payload === 'object' ? payload : null) as {
      error?: string
      conflictFiles?: unknown
      canForceOverwrite?: boolean
    } | null
    if (!parsed) return null
    if (!parsed.canForceOverwrite || !Array.isArray(parsed.conflictFiles)) {
      return null
    }
    const files = parsed.conflictFiles
      .map(file => typeof file === 'string' ? file.trim() : '')
      .filter(Boolean)
    if (files.length === 0) return null
    return {
      files,
      message: parsed.error || '拉取更新前检测到本地冲突文件',
    }
  } catch {
    return null
  }
}

function findFirstRepoCategoryId(categories: Category[]): number | null {
  for (const cat of categories) {
    if (cat.hasGitRepo) return cat.id
    if (cat.children?.length) {
      const found = findFirstRepoCategoryId(cat.children)
      if (found != null) return found
    }
  }
  return null
}

function containsCategoryId(categories: Category[], targetId: number): boolean {
  for (const cat of categories) {
    if (cat.id === targetId) return true
    if (cat.children?.length && containsCategoryId(cat.children, targetId)) return true
  }
  return false
}

function hasGitDescendant(cat: Category): boolean {
  return Boolean(cat.children?.some(child => child.hasGitRepo || hasGitDescendant(child)))
}

function filterGitTree(categories: Category[]): Category[] {
  return categories
    .filter(cat => cat.hasGitRepo || hasGitDescendant(cat))
    .map(cat => ({
      ...cat,
      children: cat.children ? filterGitTree(cat.children) : undefined,
    }))
}

function findCategoryPath(categories: Category[], targetId: number): Category[] {
  const walk = (items: Category[], path: Category[]): Category[] | null => {
    for (const cat of items) {
      const next = [...path, cat]
      if (cat.id === targetId) return next
      if (cat.children?.length) {
        const found = walk(cat.children, next)
        if (found) return found
      }
    }
    return null
  }
  return walk(categories, []) || []
}

function RepoCategorySelector({
  categories,
  selectedId,
  onSelect,
  depth = 0,
}: {
  categories: Category[]
  selectedId: number | null
  onSelect: (id: number | null) => void
  depth?: number
}) {
  return (
    <div className="space-y-1">
      {categories.map(cat => (
        <div key={cat.id}>
          {cat.hasGitRepo ? (
            <label
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
              style={{ paddingLeft: `${depth * 18 + 8}px` }}
            >
              <input
                type="radio"
                name="gitRepoSelector"
                checked={selectedId === cat.id}
                onChange={() => onSelect(cat.id)}
                className="accent-zinc-700 dark:accent-zinc-300"
              />
              <span className="truncate">{cat.name}</span>
              {cat.hasGitRepo && <span className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950">Git</span>}
            </label>
          ) : (
            <div
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-zinc-400"
              style={{ paddingLeft: `${depth * 18 + 8}px` }}
            >
              <span className="truncate">{cat.name}</span>
            </div>
          )}
          {cat.children?.length ? (
            <RepoCategorySelector categories={cat.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          ) : null}
        </div>
      ))}
    </div>
  )
}
