"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Cpu, Flame, Loader2, Newspaper, RefreshCcw, Search, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Last30DaysPanel } from "@/components/market-insights/last30days-panel"
import { listHotTopics } from "@/lib/api/client"
import type { HotTopic } from "@/types/content-template"

type HotSource = "douyin" | "aihot" | "last30days"

function formatHotValue(value: number) {
  if (!value) return "-"
  if (value >= 10000) return `${Math.round(value / 10000)}万`
  return value.toLocaleString("zh-CN")
}

function getTopicBadge(topic: HotTopic) {
  if (topic.label === "hot") return "热"
  if (topic.label === "new") return "新"
  if (topic.label === "recommended") return "荐"
  return null
}

export default function HotTopicsPage() {
  const [topics, setTopics] = useState<HotTopic[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [source, setSource] = useState<HotSource>("douyin")

  async function loadTopics(currentSource: HotSource = source) {
    if (currentSource === "last30days") return
    setIsLoading(true)
    try {
      const data = await listHotTopics({ source: currentSource === "aihot" ? "aihot" : undefined })
      setTopics(data.topics || [])
      setUpdatedAt(data.updatedAt || null)
    } catch (e) {
      console.error("Failed to load hot topics:", e)
      setTopics([])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle source switch
  const handleSourceChange = (value: string) => {
    const nextSource = value as HotSource
    setSource(nextSource)
    setQuery("")
    if (nextSource === "last30days") {
      setIsLoading(false)
      return
    }
    loadTopics(nextSource).catch(() => setIsLoading(false))
  }

  useEffect(() => {
    loadTopics(source).catch(() => setIsLoading(false))
  }, [])

  const filteredTopics = useMemo(() => {
    const keyword = query.trim()
    if (!keyword) return topics
    return topics.filter((topic) => topic.title.toLowerCase().includes(keyword.toLowerCase()))
  }, [query, topics])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-background via-muted/30 to-background p-6 shadow-sm">
        <div className="absolute right-0 top-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative z-10">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                热点中心
              </h1>
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15 transition-colors duration-200">
                {source === "last30days" ? "近30天讨论" : source === "aihot" ? "AI HOT 深度精选" : "抖音实时热榜"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {source === "last30days"
                ? "不用先想关键词，直接从推荐方向切入，检索近30天市场讨论和选题机会。"
                : source === "aihot"
                ? "集成卡兹克三年自媒体过滤策略清洗的 AI 垂直动态。打通五维评分与事件聚类，挑出最有价值的 AI 选题，一键导入智能体创作口播。"
                : "追踪当下全网大盘实时热点，支持与企业知识库、IP 定位进行动态融合结合，智能改写出爆款脚本。"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={source} onValueChange={handleSourceChange} className="w-fit">
              <TabsList className="grid grid-cols-3 h-9 p-0.5 rounded-lg bg-muted/60">
                <TabsTrigger value="douyin" className="px-4 py-1.5 text-xs font-semibold">
                  <Flame className="mr-1.5 h-3.5 w-3.5" />
                  抖音热榜
                </TabsTrigger>
                <TabsTrigger value="aihot" className="px-4 py-1.5 text-xs font-semibold">
                  <Cpu className="mr-1.5 h-3.5 w-3.5" />
                  AI HOT 精选
                </TabsTrigger>
                <TabsTrigger value="last30days" className="px-4 py-1.5 text-xs font-semibold">
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                  近30天热点
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {source !== "last30days" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 hover:bg-muted/80 active:scale-95 transition-all duration-200"
                onClick={() => loadTopics()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                )}
                刷新
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {source === "last30days" ? <Last30DaysPanel /> : (
        <Card className="overflow-hidden border-muted/60 shadow-md transition-all duration-300 hover:shadow-lg">
        <CardHeader className="border-b bg-muted/10 gap-4 sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              {source === "aihot" ? (
                <>
                  <Newspaper className="h-4 w-4 text-primary" />
                  <span>AI 领域深度快讯列表</span>
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>实时大众热点热度列表</span>
                </>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {updatedAt ? `更新时间：${new Date(updatedAt).toLocaleString("zh-CN")}` : "正在拉取实时信源..."}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={source === "aihot" ? "搜索 AI 新闻/模型/公司" : "搜索热点关键词"}
              className="pl-9 h-9 border-muted bg-background/50 focus-visible:ring-primary/30"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-sm text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span>智能体正在连接 {source === "aihot" ? "aihot.virxact.com" : "抖音热点源"}...</span>
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="py-24 text-center text-sm text-muted-foreground">
              暂无匹配的内容资讯。试试切换信源或清除搜索词。
            </div>
          ) : (
            <div className="divide-y divide-muted/40">
              {filteredTopics.slice(0, 50).map((topic, index) => {
                const badge = getTopicBadge(topic)
                return (
                  <div
                    key={topic.id || `${topic.title}-${index}`}
                    className="group flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/20 transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-300">
                          {topic.rank || index + 1}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-semibold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors duration-200 line-clamp-2">
                              {topic.title}
                            </h2>
                            {badge ? (
                              <Badge
                                variant={topic.label === "hot" ? "destructive" : "secondary"}
                                className="h-4 px-1.5 text-[10px] font-bold rounded-md"
                              >
                                {badge}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {source === "douyin" ? (
                              <>
                                <span>热度 {formatHotValue(topic.hotValue)}</span>
                                {topic.videoCount ? <span>相关视频 {formatHotValue(topic.videoCount)}</span> : null}
                              </>
                            ) : (
                              <>
                                <span className="text-primary/80 font-medium">AI 精选信源</span>
                                {topic.fetchedAt ? (
                                  <span>发布时间: {new Date(topic.fetchedAt).toLocaleString("zh-CN", {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}</span>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2 sm:justify-end items-center pl-10 sm:pl-0">
                      {topic.douyinSearchUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-muted/80 hover:bg-background hover:text-foreground text-xs transition-colors duration-200"
                          nativeButton={false}
                          render={<Link href={topic.douyinSearchUrl} target="_blank" />}
                        >
                          {source === "aihot" ? "看原文" : "看抖音"}
                          <ArrowRight className="ml-1 h-3.5 w-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-sm active:scale-95 transition-all duration-200"
                        nativeButton={false}
                        render={<Link href={`/aim?hotTopic=${encodeURIComponent(topic.title)}`} />}
                      >
                        <Sparkles className="mr-1 h-3.5 w-3.5 animate-pulse" />
                        AIM 追热点
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
        </Card>
      )}
    </div>
  )
}
