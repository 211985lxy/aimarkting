"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Loader2, Newspaper, RefreshCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AiResultPanel } from "@/components/workbench/ai-result-panel"
import { WorkbenchHero } from "@/components/workbench/workbench-hero"
import {
  getTodayAiHotBriefing,
  refreshTodayAiHotBriefing,
} from "@/lib/api/client"
import type { ApiAiHotBriefing, ApiAiHotBriefingItem } from "@/types/api"

const CATEGORY_ORDER = [
  "模型发布/更新",
  "产品发布/更新",
  "行业动态",
  "论文研究",
  "技巧与观点",
]

function formatBeijingDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value))
}

export default function AiHotBriefingPage() {
  const [briefing, setBriefing] = useState<ApiAiHotBriefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadBriefing() {
    setError(null)
    try {
      const data = await getTodayAiHotBriefing()
      setBriefing(data)
    } catch {
      setError("AI HOT 简报暂时不可用，请稍后再试。")
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      const data = await refreshTodayAiHotBriefing()
      setBriefing(data)
    } catch {
      setError("刷新失败，请稍后再试。")
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadBriefing()
  }, [])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ApiAiHotBriefingItem[]>()
    for (const label of CATEGORY_ORDER) groups.set(label, [])
    for (const item of briefing?.items ?? []) {
      const group = groups.get(item.categoryLabel) ?? []
      group.push(item)
      groups.set(item.categoryLabel, group)
    }
    return CATEGORY_ORDER.map((label) => ({
      label,
      items: groups.get(label) ?? [],
    })).filter((group) => group.items.length > 0)
      .reduce<Array<{ label: string; items: Array<ApiAiHotBriefingItem & { displayIndex: number }> }>>(
        (result, group) => {
          const previousCount = result.reduce((count, entry) => count + entry.items.length, 0)
          result.push({
            label: group.label,
            items: group.items.map((item, index) => ({
              ...item,
              displayIndex: previousCount + index + 1,
            })),
          })
          return result
        },
        []
      )
  }, [briefing])

  if (loading) return <AiHotBriefingSkeleton />

  return (
    <div className="space-y-6 pb-10">
      <WorkbenchHero
        title="AI HOT · 今日 9 点"
        subtitle="每天 9 点整理 AI HOT 精选动态，按模型、产品、行业、论文和技巧观点归类，适合直接进入选题和内容判断。"
        badge={<Badge variant="secondary">最近 24 小时精选</Badge>}
        actions={
          <>
          {briefing ? (
            <p className="text-xs text-muted-foreground">
              生成时间：{formatBeijingDateTime(briefing.generatedAt)} · 共 {briefing.items.length} 条
            </p>
          ) : null}
            <Button
              variant="outline"
              className="w-full md:w-auto"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              刷新简报
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-destructive/30">
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {!briefing || briefing.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center text-muted-foreground">
            <Newspaper className="h-9 w-9 opacity-50" />
            <p className="text-sm">今天最近 24 小时内暂时没有 AI HOT 精选条目。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedItems.map((group) => (
            <AiResultPanel
              key={group.label}
              title={group.label}
              icon={<Newspaper className="h-4 w-4 text-primary" />}
              meta={<span>{group.items.length} 条精选</span>}
              contentClassName="divide-y p-0"
              flat
            >
                {group.items.map((item) => {
                  return (
                    <article key={item.id} className="space-y-2 p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                          {item.displayIndex}
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="space-y-1">
                            <h2 className="text-sm font-semibold leading-6 text-foreground">
                              {item.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{item.source}</span>
                              <span>{item.timeText}</span>
                            </div>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            nativeButton={false}
                            render={<Link href={item.url} target="_blank" rel="noreferrer" />}
                          >
                            看原文
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </article>
                  )
                })}
            </AiResultPanel>
          ))}
        </div>
      )}
    </div>
  )
}

function AiHotBriefingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-72 rounded-lg" />
      <Skeleton className="h-56 rounded-lg" />
    </div>
  )
}
