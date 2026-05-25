import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ThumbsUp } from 'lucide-react'
import { api } from '../../api'
import type { ViewStats } from '../../types'

export function StatsPage() {
  const [stats, setStats] = useState<ViewStats | null>(null)

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {})
  }, [])

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold mb-6">统计数据</h1>

      <div className="flex gap-4 mb-8 flex-wrap">
        <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 inline-block">
          <p className="text-sm text-zinc-500 mb-1">总阅读数</p>
          <p className="text-4xl font-bold">{stats?.totalViews ?? '--'}</p>
        </div>
        <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 inline-block">
          <p className="text-sm text-zinc-500 mb-1">网站访问次数</p>
          <p className="text-4xl font-bold">{stats?.totalVisits ?? '--'}</p>
        </div>
      </div>

      {/* 阅读趋势 */}
      {stats?.dailyViews && stats.dailyViews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-medium mb-4">阅读趋势（最近半年）</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dailyViews} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: unknown) => String(d).slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(d) => `日期: ${d}`} formatter={(v) => [Number(v), '阅读数']} />
                <Line type="monotone" dataKey="count" name="阅读数" stroke="currentColor" className="stroke-zinc-700 dark:stroke-zinc-300" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 网站访问趋势 */}
      {stats?.dailyVisits && stats.dailyVisits.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-medium mb-4">网站访问趋势（最近半年）</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dailyVisits} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: unknown) => String(d).slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(d) => `日期: ${d}`} formatter={(v) => [Number(v), '访问次数']} />
                <Line type="monotone" dataKey="count" name="访问次数" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 文章阅读排行 */}
      {stats?.topArticles && stats.topArticles.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-medium mb-4">阅读排行 Top 10</h2>
          <div className="space-y-2">
            {stats.topArticles.map((item, idx) => (
              <div key={item.article.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <span className={`text-sm font-bold w-6 shrink-0 ${idx < 3 ? 'text-amber-500' : 'text-zinc-400'}`}>#{idx + 1}</span>
                <span className="flex-1 text-sm truncate">{item.article.title}</span>
                <span className="text-sm font-medium text-zinc-500 shrink-0">{item.viewCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最有帮助排行 */}
      {stats?.topHelpfulArticles && stats.topHelpfulArticles.length > 0 && (
        <div>
          <h2 className="text-base font-medium mb-4">最有帮助文章排行 Top 10</h2>
          <div className="space-y-2">
            {stats.topHelpfulArticles.map((item, idx) => (
              <div key={item.articleId} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <span className={`text-sm font-bold w-6 shrink-0 ${idx < 3 ? 'text-amber-500' : 'text-zinc-400'}`}>#{idx + 1}</span>
                <span className="flex-1 text-sm truncate">{item.title}</span>
                <span className="flex items-center gap-1 text-sm text-zinc-500 shrink-0"><ThumbsUp size={14} />{item.helpfulCount}</span>
                <span className="text-sm font-medium text-zinc-500 shrink-0">点赞率：{item.ratio}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
