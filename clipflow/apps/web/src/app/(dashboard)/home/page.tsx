"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  BookOpen,
  FileText,
  Flame,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Circle,
  Database,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getCurrentUser,
  getIpProfile,
  listAimHistory,
  listHotTopics,
  listKnowledge,
  type AimGeneration,
  type KnowledgeEntry,
} from "@/lib/api/client"
import { useAuthStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { ApiUser } from "@/types/api"
import type { HotTopic } from "@/types/content-template"

const marketingTips = [
  "把客户反复问的问题写进知识库，AIM 生成的文案会更像真实销售现场。",
  "输入不要追求完整，先把一段真实想法写进去，再让 AIM 扩展成多格式文案。",
  "企业档案越具体，生成结果越稳定。尤其是客户、卖点、案例证据这三块。",
  "朋友圈文案适合测试表达，公众号适合沉淀观点，视频脚本适合拿去录制。",
]

function getGreetingByTime(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return "早上好，今天先把一个客户问题变成三种文案。"
  if (hour >= 12 && hour < 18) return "下午好，适合整理案例和产品卖点。"
  return "晚上好，把今天遇到的客户问题沉淀进 AIM。"
}

function getTipOfTheDay(): string {
  const dayIndex = Math.floor(Date.now() / 86400000) % marketingTips.length
  return marketingTips[dayIndex]
}

function getGenerationFormats(item: AimGeneration) {
  return [
    item.videoScript ? "视频脚本" : null,
    item.wechatArticle ? "公众号" : null,
    item.momentsPost ? "朋友圈" : null,
  ].filter(Boolean)
}

interface WorkflowStep {
  step: number
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const workflowSteps: WorkflowStep[] = [
  { step: 1, label: "信息库搭建", href: "/ip-profile", icon: Database, description: "完善企业专属知识库与三维 IP 档案" },
  { step: 2, label: "AIM一键生成", href: "/aim", icon: Sparkles, description: "一键推演爆款选题与全媒介薪火文案" },
  { step: 3, label: "内容质量检控", href: "/quality-check", icon: ShieldCheck, description: "多维度AI检控与去AI味自我审核" },
  { step: 4, label: "工作台总览", href: "/home", icon: CheckCircle2, description: "看总览、查历史、管理生成的内容资产" },
]

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
  const [history, setHistory] = useState<AimGeneration[]>([])
  const [hotItems, setHotItems] = useState<HotTopic[]>([])
  const [ipComplete, setIpComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hotLoading, setHotLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [userData, knowledgeData, historyData, profile] = await Promise.all([
          getCurrentUser(),
          listKnowledge(),
          listAimHistory(1, 5),
          getIpProfile().catch(() => null),
        ])
        setCurrentUser(userData)
        setKnowledge(knowledgeData)
        setHistory(historyData)
        setIpComplete(!!profile?.isComplete)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    listHotTopics()
      .then((data) => setHotItems(data.topics))
      .finally(() => setHotLoading(false))
  }, [])

  const categoryCount = useMemo(() => {
    return new Set(knowledge.map((item) => item.category)).size
  }, [knowledge])

  const displayName = user?.name || currentUser?.name || "用户"

  const stepStatus = useMemo(() => {
    return [
      knowledge.length > 0 && ipComplete,
      history.length > 0,
      false,
      true,
    ]
  }, [knowledge.length, ipComplete, history.length])

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-8 pb-10">
      {/* 欢迎 Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-dawn-mountain p-6 sm:p-8 shadow-[0_4px_24px_rgba(197,160,89,0.08)]">
        <div className="relative z-10 space-y-2.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-xs font-semibold text-white shadow-xs backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-200" />
            <span>工作台 · AIM 四步高能流</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wider text-white">
            欢迎回来，<span className="text-amber-200 drop-shadow-sm">{displayName}</span>
          </h1>
          <p className="text-sm leading-relaxed text-white/75 sm:text-base font-medium">
            {getGreetingByTime()}
          </p>
        </div>
        <div className="absolute right-0 top-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/8 blur-3xl animate-pulse" />
        <div className="absolute right-20 bottom-0 -mb-20 h-44 w-44 rounded-full bg-amber-300/8 blur-2xl" />
      </div>

      {/* 五步工作流进度条 */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-wide">工作流进度</h2>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-0">
              {workflowSteps.map((step, index) => {
                const isActive = stepStatus[index]
                const isCurrentPage = step.href === "/home"
                return (
                  <div key={step.step} className="flex items-center gap-3 sm:gap-0 flex-1">
                    <Link
                      href={step.href}
                      className={cn(
                        "flex flex-col items-center gap-2 flex-1 rounded-lg p-3 transition-all duration-200 group",
                        isCurrentPage ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/30"
                      )}
                    >
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                        isActive
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                          : isCurrentPage
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-muted-foreground/30 text-muted-foreground group-hover:border-primary/40 group-hover:text-primary"
                      )}>
                        {isActive ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                      </div>
                      <div className="text-center">
                        <p className={cn(
                          "text-xs font-semibold",
                          isActive ? "text-emerald-600" : isCurrentPage ? "text-primary" : "text-foreground/80 group-hover:text-primary"
                        )}>{step.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 max-w-[100px]">{step.description}</p>
                      </div>
                    </Link>
                    {index < workflowSteps.length - 1 && (
                      <div className="hidden sm:flex items-center -mx-2 z-10">
                        <div className={cn("h-0.5 w-4", stepStatus[index] ? "bg-emerald-500/50" : "bg-muted-foreground/20")} />
                        <Circle className="h-1.5 w-1.5 fill-current text-muted-foreground/30" />
                        <div className={cn("h-0.5 w-4", stepStatus[index + 1] ? "bg-emerald-500/50" : "bg-muted-foreground/20")} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快捷入口 + 企业档案 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="group relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.04] via-amber-500/[0.02] to-transparent shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold tracking-wide">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/10 transition-transform group-hover:scale-110">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <span>AIM 一键生成</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-relaxed text-muted-foreground font-medium">
              输入您的业务碎片想法、客户提问或真实案例，AIM 会结合企业独家档案和知识库，一键同步生成高转化的口播视频脚本、公众号图文与朋友圈文案。
            </p>
            <Button
              render={<Link href="/aim" />}
              nativeButton={false}
              className="cursor-pointer font-semibold shadow-sm transition-all duration-200 bg-gradient-to-r from-primary to-amber-500 hover:from-primary/95 hover:to-amber-500/95 group-hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              开始生成 <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-border/60 bg-card shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold tracking-wide">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/50 text-secondary-foreground border border-border transition-transform group-hover:scale-110">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <span>企业专属档案</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-relaxed text-muted-foreground font-medium">
              您的 IP 定位、人设标签与知识资产是决定 AI 生成质量的绝对核心。定期维护与沉淀老板经验、客户问答，让生成的内容更贴近真实销售现场。
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={ipComplete ? "default" : "secondary"} className={ipComplete ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border border-emerald-500/20" : ""}>
                  {ipComplete ? "IP 定位已完善" : "IP 定位待完善"}
                </Badge>
                <Badge variant="secondary" className="bg-primary/5 text-primary border border-primary/10">
                  知识库已沉淀 {knowledge.length} 条
                </Badge>
              </div>
              <Button
                render={<Link href="/ip-profile" />}
                nativeButton={false}
                variant="outline"
                className="cursor-pointer font-semibold transition-all duration-200 hover:bg-secondary/40 group-hover:border-primary/40"
              >
                管理档案 <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI 数据卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-linear-to-b from-card to-muted/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">知识库条目</CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between">
            <div className="text-3xl font-bold tracking-tight text-foreground">{knowledge.length}</div>
            <div className="text-xs font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              持续沉淀
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-linear-to-b from-card to-muted/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">已覆盖类别</CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between">
            <div className="text-3xl font-bold tracking-tight text-foreground">{categoryCount}<span className="text-sm font-normal text-muted-foreground"> / 5</span></div>
            <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              维度多元
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-linear-to-b from-card to-muted/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">已生成内容</CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between">
            <div className="text-3xl font-bold tracking-tight text-foreground">{history.length}</div>
            <div className="text-xs font-medium text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              持续输出
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 营销小贴士 */}
      <div className="overflow-hidden rounded-xl border border-l-4 border-l-primary border-primary/20 bg-linear-to-r from-primary/[0.04] via-amber-500/[0.01] to-transparent p-5 shadow-xs transition-all duration-200 hover:shadow-sm">
        <div className="flex gap-3">
          <div className="seal-icon !h-8 !w-8 text-sm font-serif font-bold">印</div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground tracking-wide flex items-center gap-1.5">
              <span>今日营销智慧</span>
              <Badge className="badge-gold text-[10px] scale-90 px-1 py-0 select-none">道</Badge>
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground font-medium">{getTipOfTheDay()}</p>
          </div>
        </div>
      </div>

      {/* 底部两栏 */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 border-border/60 bg-card">
          <CardHeader className="pb-3 border-b border-muted/20">
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-wide">
              <BookOpen className="h-4.5 w-4.5 text-primary" />
              <span>最近生成历史</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <BookOpen className="mb-2 h-8 w-8 opacity-30" />
                <p className="text-sm">暂无生成记录，先去 AIM 一键生成文案吧</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {history.map((item) => (
                  <Link key={item.id} href="/aim" className="group block rounded-xl border border-border/50 bg-card p-4 transition-all duration-300 hover:border-primary/40 hover:bg-primary/[0.01] hover:shadow-xs hover:scale-[1.005]">
                    <p className="line-clamp-2 text-sm font-medium leading-relaxed group-hover:text-primary transition-colors">{item.rawInput}</p>
                    <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {getGenerationFormats(item).map((label) => (
                          <Badge key={label} variant="secondary" className="bg-secondary/40 hover:bg-secondary/40 text-xs px-2 py-0.5 rounded-md border border-border/20">{label}</Badge>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">{new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/60 bg-card">
          <CardHeader className="pb-3 border-b border-muted/20">
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-wide">
              <Flame className="h-4.5 w-4.5 text-orange-500 animate-pulse" />
              <span>实时热点趋势</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {hotLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full rounded-lg" />
                ))}
              </div>
            ) : hotItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">暂无热点数据。</p>
            ) : (
              <div className="space-y-2">
                {hotItems.slice(0, 8).map((item, index) => {
                  const isTop3 = index < 3
                  return (
                    <div key={item.id ?? item.title} className="group flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5 transition-all duration-300 hover:bg-secondary/20 hover:border-amber-500/20">
                      <span className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold transition-all duration-300",
                        isTop3 ? "gold-champion-badge shadow-xs" : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10 group-hover:text-foreground"
                      )}>{index + 1}</span>
                      <span className="line-clamp-1 text-sm leading-relaxed font-medium text-foreground/80 group-hover:text-foreground transition-colors">{item.title}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <Skeleton className="h-36" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  )
}