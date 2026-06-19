"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  FilePenLine,
  MessageCircle,
  Sparkles,
  Target,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  listAimHistory,
  listClientProjects,
  listKnowledge,
  type AimGeneration,
  type ClientProject,
  type KnowledgeEntry,
} from "@/lib/api/client"

function workflowStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: "草稿",
    pending_review: "待审核",
    ready_to_shoot: "待拍摄",
    shooting: "拍摄中",
    editing: "剪辑中",
    ready_to_publish: "待发布",
    published: "已发布",
    archived: "已归档",
  }
  return labels[status || "draft"] || "草稿"
}

function getContentTitle(item: AimGeneration) {
  return item.topicTitle || item.rawInput.slice(0, 42) || "未命名内容"
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [history, setHistory] = useState<AimGeneration[]>([])
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [projectData, historyData, knowledgeData] = await Promise.all([
          listClientProjects("all"),
          listAimHistory(1, 6),
          listKnowledge(),
        ])
        setProjects(projectData)
        setHistory(historyData)
        setKnowledge(knowledgeData)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === "active"),
    [projects]
  )

  const pendingItems = useMemo(
    () => history.filter((item) => item.workflowStatus !== "published" && item.workflowStatus !== "archived"),
    [history]
  )

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6 pb-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">内容生产台</h1>
          <Badge className="badge-gold border-none px-2 py-0.5 rounded-sm text-xs">内容生产版</Badge>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          网站只负责选题、文案、定位、朋友圈和质检；飞书继续负责项目管理、协作评比和数据表格。
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground">进行中全案</p>
              <p className="mt-2 text-3xl font-bold">{activeProjects.length}</p>
            </div>
            <BriefcaseBusiness className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground">待推进内容</p>
              <p className="mt-2 text-3xl font-bold">{pendingItems.length}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground">知识库条目</p>
              <p className="mt-2 text-3xl font-bold">{knowledge.length}</p>
            </div>
            <BookOpen className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.05] to-amber-500/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BriefcaseBusiness className="h-4 w-4 text-primary" />
              选择全案
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              每次生成先绑定 IP 营销全案，避免不同客户的素材和文案混在一起。
            </p>
            <Button className="w-full" nativeButton={false} render={<Link href="/projects" />}>
              进入营销全案
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.05] to-amber-500/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FilePenLine className="h-4 w-4 text-primary" />
              脚本创作官
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              把选题、原始想法或老板口述粘进去，生成短视频脚本、口播稿和拍摄交接单。
            </p>
            <Button className="w-full" nativeButton={false} render={<Link href="/aim?agent=ip_video" />}>
              去写文案
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.05] to-amber-500/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              定位策划官
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              输入客户资料、产品卖点和老板表达，生成 IP 定位、内容方向和成交路径。
            </p>
            <Button className="w-full" nativeButton={false} render={<Link href="/aim?agent=business_diagnosis" />}>
              去做定位
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              选题策划官
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              输入灵感、对标内容和用户洞察，生成可采用的选题卡。
            </p>
            <Button className="w-full" variant="outline" nativeButton={false} render={<Link href="/topic-planning" />}>
              去做选题
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-primary" />
              私域转化官
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              把主题、客户反馈或成交素材改成朋友圈文案和私域承接话术。
            </p>
            <Button className="w-full" variant="outline" nativeButton={false} render={<Link href="/aim?agent=moments_conversion" />}>
              去写朋友圈
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              内容质检官
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              检查 AI 味、开头吸引力、逻辑、表达和拍摄可行性。
            </p>
            <Button className="w-full" variant="outline" nativeButton={false} render={<Link href="/quality-check" />}>
              去质检
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-base">最近待推进内容</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 opacity-40" />
                <p className="text-sm">暂无待推进内容</p>
              </div>
            ) : (
              <div className="divide-y">
                {pendingItems.slice(0, 6).map((item) => (
                  <Link key={item.id} href="/aim" className="block p-4 transition-colors hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <p className="line-clamp-1 text-sm font-semibold">{getContentTitle(item)}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{item.rawInput}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {workflowStatusLabel(item.workflowStatus)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-base">网站和飞书的分工</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
            <p><span className="font-semibold text-foreground">1. 飞书：</span>项目管理、选题评比、协作和数据沉淀。</p>
            <p><span className="font-semibold text-foreground">2. AIM：</span>选题、脚本、定位、私域内容和质检。</p>
            <p><span className="font-semibold text-foreground">3. 全案：</span>只作为内容上下文，防止素材污染。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
