"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Lightbulb,
  Target,
  Calendar,
  ShieldAlert,
} from "lucide-react"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCompetitorAnalysis } from "@/lib/api/client"
import type { ApiCompetitorAnalysis, CompetitorAnalysisResult } from "@/types/api"

// ─── Constants ──────────────────────────────────────────

const TERMINAL_STATUSES = new Set(["completed", "failed"])
const POLL_INTERVAL = 3000

const PIPELINE_STEPS = [
  { status: "pending", label: "待处理", sublabel: "分析任务已创建，等待开始…" },
  { status: "scraping", label: "数据采集中", sublabel: "正在抓取账号数据、视频列表及互动统计…" },
  { status: "enriching", label: "数据处理中", sublabel: "正在计算互动指标和发布规律…" },
  { status: "analyzing", label: "AI 分析中", sublabel: "Claude 正在生成6维评分与深度报告…" },
  { status: "completed", label: "分析完成", sublabel: "" },
]

const PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  bilibili: "哔哩哔哩",
  kuaishou: "快手",
}

const SCORE_DIMENSIONS = [
  { key: "content_power", label: "内容力", description: "内容质量与爆款率" },
  { key: "growth_power", label: "涨粉力", description: "粉丝增长能力" },
  { key: "engagement_power", label: "互动力", description: "互动率与粉丝活跃" },
  { key: "monetization_power", label: "变现力", description: "商业价值与带货" },
  { key: "persona_power", label: "人设力", description: "IP辨识度与信任感" },
  { key: "operation_power", label: "运营力", description: "发布稳定性与数据" },
]

const TABS = [
  { value: "account_overview", label: "账号定位" },
  { value: "content_strategy", label: "内容策略" },
  { value: "growth_analysis", label: "增长分析" },
  { value: "engagement_analysis", label: "互动分析" },
  { value: "monetization_analysis", label: "变现分析" },
  { value: "recommendations", label: "对标建议" },
]

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_LABELS: Record<string, string> = {
  Sun: "日", Mon: "一", Tue: "二", Wed: "三", Thu: "四", Fri: "五", Sat: "六",
}
const HOURS = Array.from({ length: 24 }, (_, i) => i)

// ─── Helpers ─────────────────────────────────────────────

function proxyAvatarUrl(url: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

function platformLabel(platform: string) {
  return PLATFORM_LABELS[platform] ?? platform
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function formatCount(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}千`
  return String(n)
}

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600"
  if (score >= 60) return "text-amber-500"
  return "text-orange-500"
}

function cellIntensity(day: string, hour: number, heatmap: Record<string, number>, max: number) {
  const key = `${day}-${String(hour).padStart(2, "0")}`
  const v = heatmap[key] ?? 0
  if (max === 0 || v === 0) return "bg-muted/30"
  const ratio = v / max
  if (ratio <= 0.25) return "bg-primary/20"
  if (ratio <= 0.5) return "bg-primary/40"
  if (ratio <= 0.75) return "bg-primary/60"
  return "bg-primary/80"
}

// ─── Sub-Components ──────────────────────────────────────

function SectionField({ label, value }: { label: string; value: string | string[] | number | null | undefined }) {
  if (value === null || value === undefined) return null
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      {Array.isArray(value) ? (
        <ul className="space-y-1">
          {value.map((item, i) => (
            <li key={i} className="text-sm flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : typeof value === "number" ? (
        <p className="text-sm">{value}</p>
      ) : (
        <p className="text-sm leading-relaxed">{value}</p>
      )}
    </div>
  )
}

function PercentageList({ items, keyField, labelField }: {
  items: Array<Record<string, string | number>>
  keyField: string
  labelField: string
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((item, i) => (
        <Badge key={i} variant="secondary" className="text-xs">
          {String(item[labelField])} — {item.percentage}%
        </Badge>
      ))}
    </div>
  )
}

function FullPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-72 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-lg mx-auto mt-8">
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center gap-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">记录不存在</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            分析记录不存在或已被删除
          </p>
          <Button variant="outline" onClick={onBack}>返回列表</Button>
        </CardContent>
      </Card>
    </div>
  )
}

function FailedState({ analysis, onBack }: { analysis: ApiCompetitorAnalysis; onBack: () => void }) {
  return (
    <div className="max-w-lg mx-auto mt-8">
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center gap-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">分析失败</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {analysis.errorMessage ?? "分析过程中发生错误，请重试"}
          </p>
          <Button variant="outline" onClick={onBack}>返回重试</Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ProgressView({ analysis }: { analysis: ApiCompetitorAnalysis }) {
  const currentIdx = PIPELINE_STEPS.findIndex(s => s.status === analysis.status)

  return (
    <div className="space-y-8">
      <PageHeader
        title="对标分析中…"
        subtitle="请耐心等待，分析通常需要 1-2 分钟"
        backHref="/competitor"
      />
      {analysis.accountName && (
        <div className="flex items-center gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
          {analysis.accountAvatar && (
            <img
              src={proxyAvatarUrl(analysis.accountAvatar)}
              alt={analysis.accountName}
              className="h-10 w-10 rounded-full object-cover"
            />
          )}
          <div>
            <p className="font-medium">{analysis.accountName}</p>
            <p className="text-sm text-muted-foreground">{platformLabel(analysis.platform)}</p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="py-8 px-6">
          <h2 className="text-base font-semibold mb-6">正在分析中…</h2>
          <div className="space-y-5">
            {PIPELINE_STEPS.filter(s => s.status !== "completed").map((step, idx) => {
              const stepIdx = idx
              const isCurrent = stepIdx === currentIdx
              const isDone = stepIdx < currentIdx

              return (
                <div key={step.status} className="flex gap-3 items-start">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : isCurrent ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isDone ? "text-green-600" : isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </p>
                    {isCurrent && step.sublabel && (
                      <p className="text-xs text-muted-foreground mt-0.5">{step.sublabel}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReportView({ analysis }: { analysis: ApiCompetitorAnalysis }) {
  const result = (analysis.analysisResult ?? {}) as Partial<CompetitorAnalysisResult>
  const scores = result.scores ?? { content_power: 0, growth_power: 0, engagement_power: 0, monetization_power: 0, persona_power: 0, operation_power: 0, overall: 0 }
  const sections = result.sections ?? {} as CompetitorAnalysisResult["sections"]
  const stats = result.stats ?? { total_videos_analyzed: 0, date_range: { from: "", to: "" }, top_videos: [], posting_heatmap: {} }

  const radarData = [
    { subject: "内容力", value: scores.content_power ?? 0, fullMark: 100 },
    { subject: "涨粉力", value: scores.growth_power ?? 0, fullMark: 100 },
    { subject: "互动力", value: scores.engagement_power ?? 0, fullMark: 100 },
    { subject: "变现力", value: scores.monetization_power ?? 0, fullMark: 100 },
    { subject: "人设力", value: scores.persona_power ?? 0, fullMark: 100 },
    { subject: "运营力", value: scores.operation_power ?? 0, fullMark: 100 },
  ]

  const maxHeatmapVal = Math.max(0, ...Object.values(stats.posting_heatmap))

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${analysis.accountName ?? "对标账号"} · 对标报告`}
        subtitle={`分析于 ${formatDate(analysis.completedAt ?? analysis.createdAt)}`}
        backHref="/competitor"
      />

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Avatar */}
            <div className="shrink-0">
              {analysis.accountAvatar ? (
                <img
                  src={proxyAvatarUrl(analysis.accountAvatar)}
                  alt={analysis.accountName ?? ""}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
                  {(analysis.accountName ?? "?")[0]}
                </div>
              )}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-lg font-semibold truncate">{analysis.accountName ?? analysis.targetUrl}</p>
                <Badge variant="outline" className="text-xs shrink-0">{platformLabel(analysis.platform)}</Badge>
                {analysis.accountIsVerified && (
                  <Badge variant="secondary" className="text-xs shrink-0">已认证</Badge>
                )}
              </div>
              {analysis.accountSignature && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{analysis.accountSignature}</p>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                {analysis.followerCount != null && (
                  <div>
                    <p className="text-base font-semibold">{formatCount(analysis.followerCount)}</p>
                    <p className="text-xs text-muted-foreground">粉丝</p>
                  </div>
                )}
                {analysis.accountFollowingCount != null && (
                  <div>
                    <p className="text-base font-semibold">{formatCount(analysis.accountFollowingCount)}</p>
                    <p className="text-xs text-muted-foreground">关注</p>
                  </div>
                )}
                {analysis.accountTotalLikes != null && (
                  <div>
                    <p className="text-base font-semibold">{formatCount(analysis.accountTotalLikes)}</p>
                    <p className="text-xs text-muted-foreground">获赞</p>
                  </div>
                )}
                {analysis.videoCount != null && (
                  <div>
                    <p className="text-base font-semibold">{formatCount(analysis.videoCount)}</p>
                    <p className="text-xs text-muted-foreground">作品</p>
                  </div>
                )}
              </div>
            </div>

            {/* Overall score */}
            <div className="shrink-0 text-center sm:text-right self-center">
              <p className={`text-4xl font-bold ${scoreColor(analysis.overallScore ?? 0)}`}>
                {Math.round(analysis.overallScore ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">综合评分</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Radar + Score Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" className="text-xs" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
              <Radar
                name="评分"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {SCORE_DIMENSIONS.map(({ key, label, description }) => {
            const score = scores[key as keyof typeof scores] as number
            return (
              <Card key={key} className="p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${scoreColor(score)}`}>{Math.round(score)}</p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Analysis Tabs */}
      <section>
        <Tabs defaultValue="account_overview">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            {TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 账号定位 */}
          <TabsContent value="account_overview">
            <Card className="p-5">
              <SectionField label="账号类型" value={sections?.account_overview?.account_type} />
              <SectionField label="内容垂类" value={sections?.account_overview?.content_vertical} />
              <SectionField label="账号定位" value={sections?.account_overview?.positioning} />
              <SectionField label="差异化优势" value={sections?.account_overview?.differentiator} />
            </Card>
          </TabsContent>

          {/* 内容策略 */}
          <TabsContent value="content_strategy">
            <Card className="p-5">
              {sections?.content_strategy?.topic_distribution?.length ? (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">话题分布</p>
                  <PercentageList
                    items={sections.content_strategy.topic_distribution as Array<Record<string, string | number>>}
                    keyField="topic"
                    labelField="topic"
                  />
                </div>
              ) : null}
              {sections?.content_strategy?.content_formats?.length ? (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">内容形式</p>
                  <PercentageList
                    items={sections.content_strategy.content_formats as Array<Record<string, string | number>>}
                    keyField="format"
                    labelField="format"
                  />
                </div>
              ) : null}
              <SectionField label="钩子模式" value={sections?.content_strategy?.hook_patterns} />
              <SectionField label="发布频率" value={sections?.content_strategy?.posting_frequency} />
              <SectionField label="最佳发布时段" value={sections?.content_strategy?.best_posting_times} />
              <SectionField label="爆款公式" value={sections?.content_strategy?.viral_formula} />
            </Card>
          </TabsContent>

          {/* 增长分析 */}
          <TabsContent value="growth_analysis">
            <Card className="p-5">
              <SectionField label="增长趋势" value={sections?.growth_analysis?.growth_trend} />
              <SectionField label="增长驱动因素" value={sections?.growth_analysis?.growth_drivers} />
              <SectionField label="粉丝质量" value={sections?.growth_analysis?.follower_quality} />
            </Card>
          </TabsContent>

          {/* 互动分析 — prefer computed metrics over AI-generated values (AI may output 0 when views unavailable) */}
          <TabsContent value="engagement_analysis">
            <Card className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "平均互动率", value: `${(analysis.metricsData?.engagement?.weighted_engagement_rate ?? (sections?.engagement_analysis?.avg_engagement_rate ?? 0)).toFixed(2)}%` },
                  { label: "平均点赞", value: formatCount(analysis.metricsData?.engagement?.avg_likes ?? sections?.engagement_analysis?.avg_likes ?? 0) },
                  { label: "平均评论", value: formatCount(analysis.metricsData?.engagement?.avg_comments ?? sections?.engagement_analysis?.avg_comments ?? 0) },
                  { label: "平均分享", value: formatCount(analysis.metricsData?.engagement?.avg_shares ?? sections?.engagement_analysis?.avg_shares ?? 0) },
                ].map(stat => (
                  <Card key={stat.label} className="p-3 bg-muted/40 border-0">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold mt-0.5">{stat.value}</p>
                  </Card>
                ))}
              </div>
              <SectionField label="评论质量" value={sections?.engagement_analysis?.comment_quality} />
              <SectionField label="异常检测" value={sections?.engagement_analysis?.anomaly_detection} />
            </Card>
          </TabsContent>

          {/* 变现分析 */}
          <TabsContent value="monetization_analysis">
            <Card className="p-5">
              <SectionField label="变现路径" value={sections?.monetization_analysis?.monetization_paths} />
              <SectionField label="产品品类" value={sections?.monetization_analysis?.product_categories} />
              <SectionField label="预估收益水平" value={sections?.monetization_analysis?.estimated_revenue_level} />
            </Card>
          </TabsContent>

          {/* 对标建议 */}
          <TabsContent value="recommendations">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {(sections?.recommendations?.reusable_strategies?.length ?? 0) > 0 && (
                <Card className="p-4 border-l-4 border-l-green-500">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-semibold">可复用策略</p>
                  </div>
                  <ul className="space-y-1.5">
                    {sections.recommendations.reusable_strategies.map((s, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {(sections?.recommendations?.differentiation_points?.length ?? 0) > 0 && (
                <Card className="p-4 border-l-4 border-l-blue-500">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-semibold">差异化切入点</p>
                  </div>
                  <ul className="space-y-1.5">
                    {sections.recommendations.differentiation_points.map((s, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {(sections?.recommendations?.action_plan_30d?.length ?? 0) > 0 && (
                <Card className="p-4 border-l-4 border-l-amber-500">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold">30天行动计划</p>
                  </div>
                  <ul className="space-y-1.5">
                    {sections.recommendations.action_plan_30d.map((s, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-amber-500 mt-0.5 font-medium text-xs">{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {(sections?.recommendations?.risks?.length ?? 0) > 0 && (
                <Card className="p-4 border-l-4 border-l-red-400">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    <p className="text-sm font-semibold">风险提示</p>
                  </div>
                  <ul className="space-y-1.5">
                    {sections.recommendations.risks.map((s, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {!(sections?.recommendations?.reusable_strategies?.length) &&
               !(sections?.recommendations?.differentiation_points?.length) &&
               !(sections?.recommendations?.action_plan_30d?.length) &&
               !(sections?.recommendations?.risks?.length) && (
                <p className="text-sm text-muted-foreground col-span-2">暂无建议数据</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Top 10 Videos */}
      {(stats.top_videos?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Top 10 视频排行</h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>热度</TableHead>
                  <TableHead>点赞</TableHead>
                  <TableHead>互动率</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.top_videos.slice(0, 10).map((video, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{video.title || "—"}</TableCell>
                    <TableCell className="text-sm">{formatCount(video.views)}</TableCell>
                    <TableCell className="text-sm">{formatCount(video.likes)}</TableCell>
                    <TableCell className="text-sm">{video.engagement_rate.toFixed(1)}%</TableCell>
                    <TableCell>
                      {video.url && (
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      )}

      {/* Posting Time Heatmap */}
      <section>
        <h2 className="text-lg font-semibold mb-3">发布时间热力图</h2>
        <Card className="p-4 overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels row */}
            <div className="flex mb-1">
              <div className="w-8 shrink-0" />
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {h % 4 === 0 ? h : ""}
                </div>
              ))}
            </div>
            {/* Heatmap rows */}
            {DAYS.map(day => (
              <div key={day} className="flex mb-1 items-center">
                <div className="w-8 shrink-0 text-xs text-muted-foreground text-right pr-2">
                  {DAY_LABELS[day]}
                </div>
                {HOURS.map(h => (
                  <div
                    key={h}
                    className={`flex-1 h-5 rounded-sm mx-px ${cellIntensity(day, h, stats.posting_heatmap, maxHeatmapVal)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  )
}

// ─── Main Page Component ─────────────────────────────────

export default function CompetitorReportPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [analysis, setAnalysis] = useState<ApiCompetitorAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Initial fetch
  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const data = await getCompetitorAnalysis(params.id)
        setAnalysis(data)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalysis()
  }, [params.id])

  // Poll until terminal state
  useEffect(() => {
    if (!analysis || TERMINAL_STATUSES.has(analysis.status)) return
    const interval = setInterval(async () => {
      try {
        const data = await getCompetitorAnalysis(params.id)
        setAnalysis(data)
        if (TERMINAL_STATUSES.has(data.status)) clearInterval(interval)
      } catch {
        clearInterval(interval)
      }
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [analysis?.status, params.id])

  if (loading) return <FullPageSkeleton />
  if (notFound) return <NotFoundState onBack={() => router.push("/competitor")} />
  if (!analysis) return null
  if (analysis.status === "failed") return <FailedState analysis={analysis} onBack={() => router.push("/competitor")} />
  if (analysis.status !== "completed") return <ProgressView analysis={analysis} />
  return <ReportView analysis={analysis} />
}
