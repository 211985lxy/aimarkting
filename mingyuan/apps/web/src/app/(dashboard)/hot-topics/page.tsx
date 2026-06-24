"use client"

import { useState } from "react"
import { Cpu, Flame } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HotDecisionPanel } from "@/components/market-insights/hot-decision-panel"
import type { ApiHotDecisionSource } from "@/types/api"

const SOURCE_LABEL: Record<ApiHotDecisionSource, string> = {
  aihot: "AI HOT 重点精选",
  market: "全网热榜筛选",
}

const SOURCE_DESC: Record<ApiHotDecisionSource, string> = {
  aihot: "AI HOT 已经完成精选，作为热点中心的重点入口，直接看、直接进创作。",
  market: "近 30 天热榜和抖音热榜合并筛选，只保留适合借势创作的热点。",
}

export default function HotTopicsPage() {
  const [source, setSource] = useState<ApiHotDecisionSource>("aihot")

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-background via-muted/30 to-background p-6 shadow-sm">
        <div className="absolute right-0 top-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-2xl font-bold tracking-tight">
                热点中心
              </h1>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {SOURCE_LABEL[source]}
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{SOURCE_DESC[source]}</p>
          </div>

          <Tabs value={source} onValueChange={(value) => setSource(value as ApiHotDecisionSource)} className="w-fit">
            <TabsList className="grid h-9 grid-cols-2 rounded-lg bg-muted/60 p-0.5">
              <TabsTrigger value="aihot" className="px-4 py-1.5 text-xs font-semibold">
                <Cpu className="mr-1.5 h-3.5 w-3.5" />
                AI HOT
              </TabsTrigger>
              <TabsTrigger value="market" className="px-4 py-1.5 text-xs font-semibold">
                <Flame className="mr-1.5 h-3.5 w-3.5" />
                全网热榜
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <HotDecisionPanel source={source} />
    </div>
  )
}
