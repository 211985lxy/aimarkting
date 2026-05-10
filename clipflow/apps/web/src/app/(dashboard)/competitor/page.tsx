"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Link2,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  startCompetitorAnalysis,
  listCompetitorReports,
  deleteCompetitorAnalysis,
} from "@/lib/api/client"
import { ApiError } from "@/lib/api/client"
import type { ApiCompetitorReport, CompetitorAnalysisStatus } from "@/types/api"

// ─── Helpers ────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  return n.toLocaleString("zh-CN")
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "刚刚"
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}

function platformLabel(platform: string): string {
  if (platform === "douyin") return "抖音"
  if (platform === "xiaohongshu") return "小红书"
  return platform
}

function platformClass(platform: string): string {
  if (platform === "douyin") return "text-black bg-black/10 border-black/20"
  if (platform === "xiaohongshu") return "text-rose-600 bg-rose-50 border-rose-200"
  return ""
}

const SUPPORTED_DOMAINS = [
  "douyin.com",
  "iesdouyin.com",
  "v.douyin.com",
  "xiaohongshu.com",
  "xhslink.com",
  "xhs.cn",
]

function isSupportedUrl(url: string): boolean {
  return SUPPORTED_DOMAINS.some((domain) => url.includes(domain))
}

function proxyAvatarUrl(url: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

// ─── Status Badge ────────────────────────────────────────

const statusConfig: Record<
  CompetitorAnalysisStatus,
  { label: string; className: string; pulse?: boolean }
> = {
  pending: {
    label: "待处理",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    pulse: true,
  },
  scraping: {
    label: "采集中",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    pulse: true,
  },
  enriching: {
    label: "处理中",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    pulse: true,
  },
  analyzing: {
    label: "分析中",
    className: "bg-purple-100 text-purple-700 border-purple-200",
    pulse: true,
  },
  completed: {
    label: "已完成",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  failed: {
    label: "失败",
    className: "bg-red-100 text-red-700 border-red-200",
  },
}

function StatusBadge({ status }: { status: CompetitorAnalysisStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.pending
  return (
    <Badge
      variant="outline"
      className={`border text-xs ${cfg.className}${cfg.pulse ? " animate-pulse" : ""}`}
    >
      {cfg.label}
    </Badge>
  )
}

// ─── Empty State ─────────────────────────────────────────

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <BarChart2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">还没有分析记录</h2>
        <p className="text-sm text-muted-foreground mt-1">
          输入对标账号链接开始你的第一次竞品分析
        </p>
      </CardContent>
    </Card>
  )
}

// ─── History Skeleton ────────────────────────────────────

function HistorySkeleton() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>平台</TableHead>
            <TableHead>账号</TableHead>
            <TableHead>粉丝数</TableHead>
            <TableHead>综合评分</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>时间</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-5 w-14" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-7 w-7" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

// ─── Main Page ───────────────────────────────────────────

export default function CompetitorPage() {
  const router = useRouter()

  const [url, setUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [reports, setReports] = useState<ApiCompetitorReport[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [listError, setListError] = useState<string | null>(null)

  const loadReports = useCallback(async (currentPage: number) => {
    setLoading(true)
    setListError(null)
    try {
      const data = await listCompetitorReports(currentPage, 10)
      setReports(data.items)
      setTotal(data.total)
    } catch {
      setListError("加载历史记录失败，请刷新重试")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReports(page)
  }, [page, loadReports])

  async function handleSubmit() {
    const trimmed = url.trim()

    if (!trimmed) {
      setSubmitError("请输入对标账号链接")
      return
    }

    if (!isSupportedUrl(trimmed)) {
      setSubmitError("暂不支持该平台，请输入抖音或小红书账号链接")
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const result = await startCompetitorAnalysis(trimmed)
      router.push(`/competitor/${result.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { code?: string } | null
        const code = details?.code
        if (code === "UNSUPPORTED_PLATFORM") {
          setSubmitError("暂不支持该平台")
        } else if (code === "INVALID_URL") {
          setSubmitError("链接格式不正确，请重新输入")
        } else {
          setSubmitError("提交失败，请稍后重试")
        }
      } else {
        setSubmitError("提交失败，请稍后重试")
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCompetitorAnalysis(id)
      await loadReports(page)
    } catch {
      // silently ignore delete errors; list will reflect current state on next load
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="同行对标分析"
        subtitle="输入对标账号链接，AI 生成 6 维竞品分析报告"
      />

      {/* URL Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            输入对标账号链接
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="https://www.douyin.com/user/... 或 https://www.xiaohongshu.com/user/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setSubmitError(null)
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              disabled={submitting}
              className="flex-1"
            />
            <Button onClick={handleSubmit} disabled={submitting || !url.trim()}>
              {submitting ? "提交中..." : "开始分析"}
            </Button>
          </div>
          {submitError && (
            <p className="text-sm text-destructive mt-2">{submitError}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">支持抖音 · 小红书</p>
        </CardContent>
      </Card>

      {/* History Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">历史分析</h2>

        {loading ? (
          <HistorySkeleton />
        ) : reports.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>平台</TableHead>
                    <TableHead>账号</TableHead>
                    <TableHead>粉丝数</TableHead>
                    <TableHead>综合评分</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow
                      key={report.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/competitor/${report.id}`)}
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={platformClass(report.platform)}
                        >
                          {platformLabel(report.platform)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {report.accountAvatar && (
                            <img
                              src={proxyAvatarUrl(report.accountAvatar)}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          )}
                          <span className="font-medium text-sm truncate max-w-[150px]">
                            {report.accountName ?? report.targetUrl}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.followerCount != null
                          ? formatCount(report.followerCount)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {report.overallScore != null ? (
                          <span className="font-semibold text-sm">
                            {Math.round(report.overallScore)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelativeTime(report.createdAt)}
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(report.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination */}
            {total > 10 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  共 {total} 条记录
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <span className="text-sm">第 {page} 页</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 10 >= total || loading}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
