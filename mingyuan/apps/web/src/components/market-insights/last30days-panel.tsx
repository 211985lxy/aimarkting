"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ExternalLink, Flame, Loader2, MessageSquare, Wand2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AiResultPanel } from "@/components/workbench/ai-result-panel"

interface Last30DaysItem {
  id: string
  platform: string
  title: string
  excerpt: string
  url: string
  author: string
  date: string
  score: number
  engagement?: {
    likes?: number
    num_comments?: number
  }
}

interface Last30DaysResult {
  topic: string
  dateRange: { from: string; to: string }
  items: Last30DaysItem[]
  warnings: string[]
  summary: string
}

const ALL_SEARCH_PLATFORMS = [
  { id: "weibo", name: "微博" },
  { id: "xiaohongshu", name: "小红书" },
  { id: "bilibili", name: "哔哩哔哩" },
  { id: "zhihu", name: "知乎" },
  { id: "douyin", name: "抖音" },
  { id: "wechat", name: "微信" },
  { id: "baidu", name: "百度" },
  { id: "toutiao", name: "今日头条" },
]

const MARKET_TOPIC_PRESETS = [
  { topic: "AI智能体", heat: "高关注", reason: "老板AI化、自动化工作流和Agent工具都在持续讨论" },
  { topic: "企业AI落地", heat: "高关注", reason: "适合观察企业老板、管理层和服务商的真实需求" },
  { topic: "短视频获客", heat: "高转化", reason: "适合找内容选题、成交话术和行业案例" },
  { topic: "老板IP", heat: "强相关", reason: "适合分析定位、人设、信任建立和成交路径" },
  { topic: "小红书运营", heat: "内容密集", reason: "适合观察种草、获客、账号起号和爆文结构" },
  { topic: "内容自动化", heat: "增长趋势", reason: "适合研究AI内容生产、矩阵运营和降本增效" },
]

function formatCount(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  return n.toString()
}

function getPlatformBadge(platform: string) {
  const pMap: Record<string, { label: string; className: string }> = {
    weibo: { label: "微博", className: "bg-red-50 text-red-700 border-red-200" },
    xiaohongshu: { label: "小红书", className: "bg-pink-50 text-pink-700 border-pink-200" },
    bilibili: { label: "B站", className: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
    zhihu: { label: "知乎", className: "bg-blue-50 text-blue-700 border-blue-200" },
    douyin: { label: "抖音", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
    wechat: { label: "微信", className: "bg-green-50 text-green-700 border-green-200" },
    baidu: { label: "百度", className: "bg-sky-50 text-sky-700 border-sky-200" },
    toutiao: { label: "头条", className: "bg-orange-50 text-orange-700 border-orange-200" },
  }
  const config = pMap[platform] || { label: platform, className: "bg-gray-50 text-gray-700 border-gray-200" }
  return <Badge variant="outline" className={`shrink-0 ${config.className}`}>{config.label}</Badge>
}

function renderMarkdownSummary(text: string) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
      {text.split("\n").map((line, idx) => {
        if (line.startsWith("#")) {
          return <p key={idx} className="mt-2 font-bold text-foreground">{line.replace(/^#+\s*/, "")}</p>
        }
        if (line.startsWith("* ") || line.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{line.substring(2)}</span>
            </div>
          )
        }
        return <p key={idx}>{line}</p>
      })}
    </div>
  )
}

export function Last30DaysPanel() {
  const [researchTopic, setResearchTopic] = useState("")
  const [selectedSources, setSelectedSources] = useState<string[]>(ALL_SEARCH_PLATFORMS.map((p) => p.id))
  const [researching, setResearching] = useState(false)
  const [researchResult, setResearchResult] = useState<Last30DaysResult | null>(null)
  const [researchError, setResearchError] = useState<string | null>(null)

  async function handleStartResearch(topicOverride?: string) {
    const trimmed = (topicOverride ?? researchTopic).trim()
    if (!trimmed) return toast.error("请输入研究主题")
    if (selectedSources.length === 0) return toast.error("请至少选择一个搜索源")

    setResearching(true)
    setResearchError(null)
    setResearchTopic(trimmed)
    try {
      const response = await fetch("/api/market-insights/last30days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed, sources: selectedSources }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "检索失败")
      setResearchResult(data)
      toast.success("检索完成")
    } catch (err) {
      const message = err instanceof Error ? err.message : "检索失败，请稍后重试"
      setResearchError(message)
      toast.error(message)
    } finally {
      setResearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <AiResultPanel
        title="近30天热点研究"
        icon={<MessageSquare className="h-4 w-4 text-primary" />}
        meta={<span>选择一个热门方向，系统会实时检索各大中国平台近30天讨论</span>}
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MARKET_TOPIC_PRESETS.map((preset) => (
              <button
                key={preset.topic}
                type="button"
                onClick={() => !researching && handleStartResearch(preset.topic)}
                disabled={researching}
                className="rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-foreground">{preset.topic}</span>
                  <Badge variant="secondary" className="text-[11px]">
                    <Flame className="mr-1 h-3 w-3" />
                    {preset.heat}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{preset.reason}</p>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Input
              placeholder="也可以手动输入：AI手机、短剧出海、椰子水经济..."
              value={researchTopic}
              onChange={(e) => setResearchTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !researching && handleStartResearch()}
              disabled={researching}
              className="flex-1"
            />
            <Button onClick={() => handleStartResearch()} disabled={researching || !researchTopic.trim()}>
              {researching ? <Loader2 className="h-4 w-4 animate-spin" /> : "开始研究"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-3">
            {ALL_SEARCH_PLATFORMS.map((platform) => {
              const isSelected = selectedSources.includes(platform.id)
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() =>
                    !researching && setSelectedSources((prev) =>
                      prev.includes(platform.id) ? prev.filter((id) => id !== platform.id) : [...prev, platform.id],
                    )
                  }
                  disabled={researching}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    isSelected ? "border-primary/30 bg-primary/10 text-primary" : "border-transparent bg-muted text-muted-foreground"
                  }`}
                >
                  {platform.name}
                </button>
              )
            })}
          </div>
        </div>
      </AiResultPanel>

      {researchError ? (
        <Card className="border-red-200 bg-red-50 text-red-700">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{researchError}</span>
          </CardContent>
        </Card>
      ) : null}

      {researching ? (
        <Card className="border-primary/20 bg-primary/[0.01]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <h3 className="text-base font-semibold text-foreground">正在搜集全网近30天的讨论热点...</h3>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">实时检索需要一点时间，请稍等。</p>
          </CardContent>
        </Card>
      ) : null}

      {!researching && researchResult ? (
        <div className="space-y-6">
          {researchResult.warnings.length > 0 ? (
            <Card className="border-amber-100 bg-amber-50/[0.3] text-amber-800/90">
              <CardContent className="p-3 text-xs">
                部分渠道未完整覆盖：{researchResult.warnings.join("；")}
              </CardContent>
            </Card>
          ) : null}

          {researchResult.summary ? (
            <AiResultPanel
              title="30天市场讨论智能透视"
              icon={<Wand2 className="h-4 w-4 text-primary" />}
              meta={<span>{researchResult.dateRange.from} 至 {researchResult.dateRange.to}</span>}
            >
              <div className="rounded-lg border bg-muted/40 p-4">{renderMarkdownSummary(researchResult.summary)}</div>
            </AiResultPanel>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {researchResult.items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-center justify-between gap-2 border-b pb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {getPlatformBadge(item.platform)}
                      <span className="truncate text-xs font-semibold text-muted-foreground">@{item.author}</span>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {item.date ? new Date(item.date).toLocaleDateString("zh-CN") : "30天内"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{item.title}</p>
                    {item.excerpt && item.excerpt !== item.title ? (
                      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{item.excerpt}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t pt-2">
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {item.score > 0 ? <span className="font-semibold text-amber-600">推荐度: {item.score}</span> : null}
                      {item.engagement?.likes != null ? <span>赞 {formatCount(item.engagement.likes)}</span> : null}
                      {item.engagement?.num_comments != null ? <span>评 {formatCount(item.engagement.num_comments)}</span> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" nativeButton={false} render={<Link href={`/aim?agent=ip_video&mode=asset_pack&idea=${encodeURIComponent(item.title)}`} />}>
                        <Wand2 className="h-3 w-3" />
                        创作
                      </Button>
                      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={item.url} target="_blank" rel="noopener noreferrer" />}>
                        原文
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
