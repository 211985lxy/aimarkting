"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  RefreshCw,
  Trash2,
  Plus,
  Clock,
  Video,
  Flame,
  User,
  ExternalLink,
  Target,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ApiError } from "@/lib/api/client"
import {
  listWatchAccounts,
  addWatchAccount,
  deleteWatchAccount,
  refreshWatchAccounts,
  startCompetitorAnalysis,
  type WatchAccount,
} from "@/lib/api/client"
import { extractPureUrl, checkUrlType } from "@/lib/tikhub/url-parser"

// ─── Helpers ────────────────────────────────────────────

const SUPPORTED_DOMAINS = ["douyin.com", "iesdouyin.com", "v.douyin.com"]

function isSupportedUrl(url: string): boolean {
  return SUPPORTED_DOMAINS.some((domain) => url.includes(domain))
}

function proxyAvatarUrl(url: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

function proxyCoverUrl(url: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "尚未刷新"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "刚刚"
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}天前`
  return new Date(iso).toLocaleDateString("zh-CN")
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  return n.toLocaleString("zh-CN")
}

function formatAccountName(account: WatchAccount): string {
  if (account.nickname) return account.nickname

  try {
    const url = new URL(account.targetUrl)
    const pathParts = url.pathname.split("/").filter(Boolean)
    const tail = pathParts[pathParts.length - 1]
    if (tail) return `抖音账号 · ${tail.slice(0, 12)}`
  } catch {
    // Keep the fallback readable even when a pasted URL is not normalized.
  }

  return "抖音账号（待刷新）"
}

function compactAccountUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const text = `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "")
    return text.length > 46 ? `${text.slice(0, 43)}...` : text
  } catch {
    return url.length > 46 ? `${url.slice(0, 43)}...` : url
  }
}

function formatRefreshError(error: string): string {
  if (error.includes("Timeout") || error.includes("超时")) {
    return "本地浏览器访问抖音超时，账号链接已保存，可以稍后再刷新。"
  }
  if (error.includes("BrowserType.launch") || error.includes("browser")) {
    return "本地浏览器启动失败，账号链接已保存，可以稍后再试。"
  }
  return error.split("\n")[0] || "刷新失败，账号链接已保存。"
}

function refreshStatusBadge(account: WatchAccount) {
  if (account.refreshStatus === "refreshing")
    return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 animate-pulse">刷新中</Badge>
  if (account.refreshStatus === "failed")
    return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">失败</Badge>
  if (account.refreshStatus === "success")
    return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">已刷新</Badge>
  return <Badge variant="outline">待刷新</Badge>
}

// ─── Main Page ─────────────────────────────────────────

export default function CompetitorWatchPage() {
  const router = useRouter()
  const [analyzingUrl, setAnalyzingUrl] = useState<string | null>(null)

  async function handleAnalyze(url: string) {
    setAnalyzingUrl(url)
    try {
      const result = await startCompetitorAnalysis(url)
      toast.success("已成功创建分析任务，正在为您跳转...")
      router.push(`/competitor/${result.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "启动分析失败，请重试")
    } finally {
      setAnalyzingUrl(null)
    }
  }
  const [accounts, setAccounts] = useState<WatchAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [addUrl, setAddUrl] = useState("")
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)

  const loadAccounts = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const data = await listWatchAccounts()
      setAccounts(data.items)
      if (data.items.length > 0) {
        setActiveAccountId((prev) => {
          const exists = data.items.some((a) => a.id === prev)
          return exists ? prev : data.items[0].id
        })
      } else {
        setActiveAccountId(null)
      }
    } catch {
      toast.error("加载监控列表失败")
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  // 初始化加载一次
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!accounts.some((account) => account.refreshStatus === "refreshing")) return

    const timer = window.setInterval(() => {
      void loadAccounts(false)
    }, 3000)

    return () => window.clearInterval(timer)
  }, [accounts, loadAccounts])

  async function handleAdd() {
    const trimmed = addUrl.trim()
    if (!trimmed) return

    if (!isSupportedUrl(trimmed)) {
      toast.error("第一版暂时只支持抖音主页链接")
      return
    }
    const typeError = checkUrlType(trimmed)
    if (typeError) {
      toast.error(typeError)
      return
    }

    const pureUrl = extractPureUrl(trimmed)
    if (!pureUrl) {
      toast.error("链接格式不正确")
      return
    }

    setAdding(true)
    try {
      await addWatchAccount(pureUrl)
      toast.success("已添加监控账号")
      setAddUrl("")
      await loadAccounts()
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = err.details ? String((err.details as Record<string, unknown>).error || "") : ""
        toast.error(msg || "添加失败")
      } else {
        toast.error("添加失败")
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWatchAccount(id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
      setActiveAccountId((prev) => {
        if (prev === id) {
          const remaining = accounts.filter((a) => a.id !== id)
          return remaining.length > 0 ? remaining[0].id : null
        }
        return prev
      })
      toast.success("已移除监控账号")
    } catch {
      toast.error("移除失败")
    }
  }

  async function handleRefreshAll() {
    setRefreshing(true)
    try {
      const result = await refreshWatchAccounts()
      if (result.summary.failed > 0) {
        const firstError = result.results.find((item) => item.status === "failed")?.error
        toast.error(firstError ? formatRefreshError(firstError) : `刷新失败: ${result.summary.failed}/${result.summary.total}`)
      } else {
        toast.success(`已开始刷新 ${result.summary.total} 个账号`)
      }
      await loadAccounts(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刷新失败")
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRefreshOne(accountId: string) {
    setRefreshingId(accountId)
    // 先标记本地为刷新中
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, refreshStatus: "refreshing" } : a)),
    )
    try {
      const result = await refreshWatchAccounts(accountId)
      await loadAccounts(false)
      const failed = result.results.find((item) => item.status === "failed")
      if (failed) {
        toast.error(failed.error ? formatRefreshError(failed.error) : "刷新失败，账号链接已保存。")
      } else {
        toast.success("已开始后台刷新")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刷新失败")
      await loadAccounts()
    } finally {
      setRefreshingId(null)
    }
  }

  // 按刷新状态排序：刷新中 > 待刷新 > 失败 > 已刷新
  const sortedAccounts = [...accounts].sort((a, b) => {
    const order: Record<string, number> = { refreshing: 0, idle: 1, failed: 2, success: 3 }
    return (order[a.refreshStatus] ?? 9) - (order[b.refreshStatus] ?? 9)
  })

  // 获取当前选中的账号数据，没有选中时默认显示第一个
  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0]

  const activeLatestVideos = activeAccount && activeAccount.latestVideos
    ? (activeAccount.latestVideos || [])
        .map((v) => ({ ...v, account: activeAccount }))
        .sort((a, b) => b.createTime - a.createTime)
        .slice(0, 30)
    : []

  const activeViralVideos = activeAccount && activeAccount.viralVideos
    ? (activeAccount.viralVideos || [])
        .map((v) => ({ ...v, account: activeAccount }))
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 30)
    : []

  const hasRefreshingAccount = accounts.some((account) => account.refreshStatus === "refreshing")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">对标账号监控</h1>
          <p className="text-sm text-muted-foreground mt-1">
            监控 5-10 个抖音对标账号，手动刷新查看最新作品与爆款参考
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={refreshing || hasRefreshingAccount || sortedAccounts.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "刷新中..." : "刷新全部"}
          </Button>
        </div>
      </div>

      {/* Add Account Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            添加监控账号
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="https://www.douyin.com/user/..."
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              disabled={adding || accounts.length >= 10}
              className="flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={adding || !addUrl.trim() || accounts.length >= 10}
            >
              {adding ? "添加中..." : `添加 (${accounts.length}/10)`}
            </Button>
          </div>
          {accounts.length >= 10 && (
            <p className="text-xs text-amber-600 mt-2">已达到 10 个账号上限</p>
          )}
        </CardContent>
      </Card>

      {/* Account Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedAccounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">还没有监控账号</h2>
            <p className="text-sm text-muted-foreground mt-1">
              在上方输入抖音对标账号主页链接开始监控
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Account Pool Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedAccounts.map((account) => (
              <Card
                key={account.id}
                className={`group relative overflow-hidden cursor-pointer transition-all border ${
                  (activeAccountId || (accounts[0] && accounts[0].id)) === account.id
                    ? "ring-2 ring-primary/60 border-primary bg-primary/[0.01] shadow-xs"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setActiveAccountId(account.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {account.avatar ? (
                        <img
                          src={proxyAvatarUrl(account.avatar)}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {formatAccountName(account)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {account.followerCount != null
                              ? `${formatCount(account.followerCount)} 粉丝`
                              : "抖音"}
                          </span>
                          {refreshStatusBadge(account)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <a
                    href={account.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    title={account.targetUrl}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{compactAccountUrl(account.targetUrl)}</span>
                  </a>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2.5 text-xs font-semibold border-primary/20 hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAnalyze(account.targetUrl)
                    }}
                    disabled={analyzingUrl === account.targetUrl}
                  >
                    {analyzingUrl === account.targetUrl ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Target className="h-3.5 w-3.5 text-primary" />
                    )}
                    {analyzingUrl === account.targetUrl ? "启动分析中..." : "AI 深度调查"}
                  </Button>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(account.lastRefreshedAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRefreshOne(account.id)
                        }}
                        disabled={refreshingId === account.id || account.refreshStatus === "refreshing"}
                        title="刷新该账号"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === account.id ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(account.id)
                        }}
                        title="移除监控"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {account.refreshStatus === "failed" && account.refreshError && (
                    <p className="mt-2 rounded-md bg-red-50 px-2.5 py-2 text-xs leading-5 text-red-600">
                      {formatRefreshError(account.refreshError)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Latest Videos Section */}
          {activeLatestVideos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="h-4 w-4" />
                  最新作品
                  <Badge variant="secondary" className="text-xs ml-1">{activeLatestVideos.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {activeLatestVideos.map((video) => (
                    <a
                      key={`${video.account.id}-${video.videoId}`}
                      href={`https://www.douyin.com/video/${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/video relative aspect-[9/16] rounded-lg overflow-hidden bg-muted"
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-b from-muted/30 to-muted-foreground/10 p-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50 backdrop-blur-xs text-muted-foreground/60 shadow-xs">
                          <Video className="h-5 w-5" />
                        </span>
                      </div>
                      <img
                        src={proxyCoverUrl(video.coverUrl)}
                        alt={video.title || "作品"}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover/video:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs text-white font-medium line-clamp-1">
                          {video.title || "无标题"}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-white/70 mt-0.5">
                          <span>❤️ {formatCount(video.likes)}</span>
                          <span>💬 {formatCount(video.comments)}</span>
                        </div>
                      </div>
                      <div className="absolute top-1.5 left-1.5">
                        <span className="text-[10px] px-1 py-0.5 rounded bg-black/50 text-white/80 truncate max-w-20 block">
                          {video.account.nickname || ""}
                        </span>
                      </div>
                      <ExternalLink className="absolute top-1.5 right-1.5 h-3 w-3 text-white/50 opacity-0 group-hover/video:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Viral Videos Section */}
          {activeViralVideos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-4 w-4 text-orange-500" />
                  爆款作品
                  <Badge variant="secondary" className="text-xs ml-1">{activeViralVideos.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {activeViralVideos.map((video) => (
                    <a
                      key={`viral-${video.account.id}-${video.videoId}`}
                      href={`https://www.douyin.com/video/${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/video relative aspect-[9/16] rounded-lg overflow-hidden bg-muted ring-1 ring-orange-300/50"
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-b from-muted/30 to-muted-foreground/10 p-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50 backdrop-blur-xs text-muted-foreground/60 shadow-xs">
                          <Video className="h-5 w-5" />
                        </span>
                      </div>
                      <img
                        src={proxyCoverUrl(video.coverUrl)}
                        alt={video.title || "爆款作品"}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover/video:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs text-white font-medium line-clamp-1">
                          {video.title || "无标题"}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-white/70 mt-0.5">
                          <span>❤️ {formatCount(video.likes)}</span>
                          <span>💬 {formatCount(video.comments)}</span>
                          <span className="text-orange-300">🔥 {formatCount(video.engagementScore)}</span>
                        </div>
                      </div>
                      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between">
                        <span className="text-[10px] px-1 py-0.5 rounded bg-black/50 text-white/80 truncate max-w-20">
                          {video.account.nickname || ""}
                        </span>
                        <span className="text-[10px] px-1 py-0.5 rounded bg-orange-500/80 text-white font-bold">
                          爆款
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
