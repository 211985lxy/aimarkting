"use client"

import { useEffect, useMemo, useRef, useState, startTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Check,
  Clipboard,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AiResultPanel } from "@/components/workbench/ai-result-panel"
import { WorkbenchHero } from "@/components/workbench/workbench-hero"
import {
  createKnowledge,
  deleteKnowledge,
  generateTopics,
  getTodayAiHotBriefing,
  getTodayTopics,
  listClientProjects,
  listKnowledge,
  selectTopic,
  updateKnowledge,
  type ClientProject,
  type KnowledgeEntry,
} from "@/lib/api/client"
import { buildDefaultKnowledgeTags, mergeKnowledgeTags } from "@/lib/knowledge-tags"
import { buildTopicDailyReport, type TopicDailyReport, type TopicDailyReportSource } from "@/lib/topic-daily-report"
import { buildTopicPoolDraftFromSearchParams } from "@/lib/topic-pool-draft"
import type { ApiAiHotBriefingItem, ApiTopicCard, ApiTopicRecommendationMode } from "@/types/api"

type TopicCategory = "daily_inspiration" | "benchmark_reference" | "user_insight"

const CATEGORY_META: Record<
  TopicCategory,
  {
    label: string
    description: string
    titlePlaceholder: string
    contentPlaceholder: string
  }
> = {
  daily_inspiration: {
    label: "日常灵感",
    description: "老板随口一句、客户现场一句话、想到的切入角度，都先收进来。",
    titlePlaceholder: "例如：老板晨会金句",
    contentPlaceholder: "记录原话、场景或你想到的选题切口。",
  },
  benchmark_reference: {
    label: "参考素材",
    description: "人工粘贴优质账号链接、爆款标题、开头方式或结构拆解。",
    titlePlaceholder: "例如：某优质账号爆款开头",
    contentPlaceholder: "贴链接、标题、开头文案，或你观察到的结构节奏。",
  },
  user_insight: {
    label: "用户洞察",
    description: "把客户高频问题、成交阻力、评论区疑问沉淀成稳定输入。",
    titlePlaceholder: "例如：客户总问售后响应多久",
    contentPlaceholder: "记录真实问题、原话、聊天片段或成交顾虑。",
  },
}

const CATEGORY_ORDER: TopicCategory[] = [
  "daily_inspiration",
  "benchmark_reference",
  "user_insight",
]

const MODE_META: Record<ApiTopicRecommendationMode, { label: string; description: string }> = {
  normal: {
    label: "常规选题",
    description: "基于已选素材生成可采用的选题卡。",
  },
  daily: {
    label: "选题日报",
    description: "结合今日 AI HOT 和项目资料，生成当天可执行的选题日报。",
  },
  weekly: {
    label: "本周选题",
    description: "生成一组更适合沉淀为本周内容池的选题。",
  },
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  })
}

const SCORE_DIMENSIONS = [
  ["projectFit", "项目匹配"],
  ["contentValue", "内容价值"],
  ["viralHook", "传播钩子"],
  ["conversionFit", "成交关联"],
  ["feasibility", "可执行"],
] as const

const SCARCITY_BADGE: Record<string, string> = {
  scenery: "稀缺·景观",
  emotion: "稀缺·情感",
  beauty: "稀缺·美好",
  info: "稀缺·资讯",
  curio: "稀缺·奇闻",
  event: "稀缺·事件",
}

const RHETORIC_BADGE: Record<string, string> = {
  fu: "赋",
  bi: "比",
  xing: "兴",
}

// 含金量阈值（软门槛：标红 + 建议，不拦截"采用"）
const NOVELTY_HIGH = 75
const NOVELTY_LOW = 60

const VERDICT_META: Record<NonNullable<ApiTopicCard["reviewVerdict"]>, { label: string; className: string }> = {
  strong: { label: "主推", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  usable: { label: "可用", className: "border-sky-200 bg-sky-50 text-sky-700" },
  observe: { label: "观察", className: "border-amber-200 bg-amber-50 text-amber-700" },
  revise: { label: "需优化", className: "border-rose-200 bg-rose-50 text-rose-700" },
}

function scoreEntries(card: ApiTopicCard) {
  const breakdown = card.scoreBreakdown
  if (!breakdown) return []
  return SCORE_DIMENSIONS.map(([key, label]) => ({ key, label, value: breakdown[key] }))
}

function strongestAndWeakest(card: ApiTopicCard) {
  const entries = scoreEntries(card)
  if (entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => b.value - a.value)
  return { strongest: sorted[0], weakest: sorted[sorted.length - 1] }
}

// ─── 四分类分区 ──────────────────────────────────────────

interface TopicCategoryGroup {
  key: string
  label: string
  cards: ApiTopicCard[]
}

function categorizeTopicCards(cards: ApiTopicCard[]): TopicCategoryGroup[] {
  const assigned = new Set<number>()
  const groups: TopicCategoryGroup[] = [
    { key: "content_line", label: "内容线选题", cards: [] },
    { key: "hot", label: "热点选题", cards: [] },
    { key: "persona", label: "人设选题", cards: [] },
    { key: "conversion", label: "转化选题", cards: [] },
  ]

  for (const card of cards) {
    const idx = cards.indexOf(card)
    // 优先级：contentLine > 热点 > 人设 > 转化 > 流量
    if (card.contentLine) {
      groups[0].cards.push(card)
      assigned.add(idx)
    } else if (card.sourceType === "行业热点") {
      groups[1].cards.push(card)
      assigned.add(idx)
    }
  }

  for (const card of cards) {
    const idx = cards.indexOf(card)
    if (assigned.has(idx)) continue
    if (card.topicType === "人设型") {
      groups[2].cards.push(card)
      assigned.add(idx)
    }
  }

  for (const card of cards) {
    const idx = cards.indexOf(card)
    if (assigned.has(idx)) continue
    if (card.topicType === "转化型") {
      groups[3].cards.push(card)
      assigned.add(idx)
    }
  }

  // 剩余（流量型等）归入转化
  for (const card of cards) {
    const idx = cards.indexOf(card)
    if (assigned.has(idx)) continue
    groups[3].cards.push(card)
  }

  return groups.filter((g) => g.cards.length > 0)
}

export default function TopicPlanningPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const importedDraftKey = useRef("")
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([])
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingKnowledge, setLoadingKnowledge] = useState(false)
  const [knowledgeLoadedProjectId, setKnowledgeLoadedProjectId] = useState<string | null>(null)
  const [savingCategory, setSavingCategory] = useState<TopicCategory | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [recommendationMode, setRecommendationMode] = useState<ApiTopicRecommendationMode>("daily")
  const [topicCards, setTopicCards] = useState<ApiTopicCard[]>([])
  const [dailyBriefingItems, setDailyBriefingItems] = useState<ApiAiHotBriefingItem[]>([])
  const [dailyReportSources, setDailyReportSources] = useState<TopicDailyReportSource[]>([])
  const [topicSelectionId, setTopicSelectionId] = useState<string | null>(null)
  const [selectedTopicIndex, setSelectedTopicIndex] = useState<number | null>(null)
  const [topicRefreshCount, setTopicRefreshCount] = useState(0)
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [autoGenerateError, setAutoGenerateError] = useState("")
  const [forms, setForms] = useState<Record<TopicCategory, { title: string; content: string }>>({
    daily_inspiration: { title: "", content: "" },
    benchmark_reference: { title: "", content: "" },
    user_insight: { title: "", content: "" },
  })

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const generationKnowledgeIds = selectedKnowledgeIds.length > 0
    ? selectedKnowledgeIds
    : knowledgeEntries.map((entry) => entry.id)

  useEffect(() => {
    const draft = buildTopicPoolDraftFromSearchParams(searchParams)
    if (!draft) return

    const draftKey = `${draft.title}\n${draft.content}`
    startTransition(() => {
      setForms((current) => ({
        ...current,
        daily_inspiration: draft,
      }))
    })

    if (!selectedProjectId || knowledgeLoadedProjectId !== selectedProjectId) return

    const importKey = `${selectedProjectId}\n${draftKey}`
    if (importedDraftKey.current === importKey) return
    importedDraftKey.current = importKey

    const existing = knowledgeEntries.find(
      (entry) =>
        entry.category === "daily_inspiration" &&
        entry.title === draft.title &&
        entry.content === draft.content,
    )
    if (existing) {
      startTransition(() => {
        setSelectedKnowledgeIds((current) => [...new Set([existing.id, ...current])])
      })
      toast.success("热点已在选题池中，并已选中")
      return
    }

    let cancelled = false
    startTransition(() => setSavingCategory("daily_inspiration"))
    createKnowledge({
      projectId: selectedProjectId,
      category: "daily_inspiration",
      title: draft.title,
      content: draft.content,
      tags: mergeKnowledgeTags(["AI HOT"], buildDefaultKnowledgeTags("daily_inspiration")),
      sourceType: "import",
    })
      .then((entry) => {
        if (cancelled) return
        setKnowledgeEntries((current) => [entry, ...current])
        setSelectedKnowledgeIds((current) => [...new Set([entry.id, ...current])])
        toast.success("热点已加入选题池，并已选中")
      })
      .catch((error) => {
        if (cancelled) return
        toast.error(error instanceof Error ? error.message : "热点加入选题池失败")
      })
      .finally(() => {
        if (!cancelled) setSavingCategory(null)
      })

    return () => {
      cancelled = true
    }
  }, [knowledgeEntries, knowledgeLoadedProjectId, searchParams, selectedProjectId])

  useEffect(() => {
    listClientProjects()
      .then((projectData) => {
        setProjects(projectData)
        setSelectedProjectId(projectData[0]?.id || "")
      })
      .catch(() => {
        toast.error("选题工作台初始化失败，请刷新后重试")
      })
      .finally(() => setLoadingProjects(false))
  }, [])

  useEffect(() => {
    if (!selectedProjectId) {
      startTransition(() => {
        setKnowledgeEntries([])
        setSelectedKnowledgeIds([])
        setKnowledgeLoadedProjectId(null)
        setTopicCards([])
        setDailyBriefingItems([])
        setDailyReportSources([])
        setTopicSelectionId(null)
        setSelectedTopicIndex(null)
        setTopicRefreshCount(0)
      })
      return
    }

    startTransition(() => {
      setLoadingKnowledge(true)
      setKnowledgeLoadedProjectId(null)
    })
    listKnowledge({ projectId: selectedProjectId, status: "active" })
      .then((entries) => {
        setKnowledgeEntries(entries)
        setSelectedKnowledgeIds([])
        setKnowledgeLoadedProjectId(selectedProjectId)
        setTopicCards([])
        setDailyBriefingItems([])
        setDailyReportSources([])
        setTopicSelectionId(null)
        setSelectedTopicIndex(null)
        setTopicRefreshCount(0)
      })
      .catch(() => toast.error("项目素材读取失败，请稍后重试"))
      .finally(() => setLoadingKnowledge(false))
  }, [selectedProjectId])

  // ─── 自动生成：进页/切换项目后，若今天没有 daily 缓存则自动生成 ──
  useEffect(() => {
    if (!selectedProjectId || knowledgeLoadedProjectId !== selectedProjectId || loadingKnowledge) return
    if (topicCards.length > 0) return // 已有卡片不重复触发

    let cancelled = false
    startTransition(() => setAutoGenerating(true))

    getTodayTopics("daily")
      .then((result) => {
        if (cancelled) return
        if (result.mode === "cached" && result.cards && result.cards.length > 0 && result.topicSelectionId) {
          setTopicCards(result.cards)
          setTopicSelectionId(result.topicSelectionId)
          setSelectedTopicIndex(null)
          setTopicRefreshCount((c) => c + 1)
          getTodayAiHotBriefing()
            .then((briefing) => {
              if (!cancelled) setDailyBriefingItems(briefing.items)
            })
            .catch(() => {})
          toast.success("已加载今日推荐选题")
          return
        }
        // missing → 自动生成
        const entryIds = knowledgeEntries.map((e) => e.id)
        return generateTopics({
          projectId: selectedProjectId,
          knowledgeEntryIds: entryIds,
          refreshCount: 0,
          recommendationMode: "daily",
        })
      })
      .then((genResult) => {
        if (cancelled || !genResult) return
        setAutoGenerateError("")
        setTopicCards(genResult.cards)
        setDailyReportSources(genResult.sourceHighlights ?? [])
        setTopicSelectionId(genResult.topicSelectionId)
        setSelectedTopicIndex(null)
        setTopicRefreshCount((c) => c + 1)
        toast.success("已自动生成今日推荐选题")
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[topic-auto] Auto-generation failed:", err)
        setAutoGenerateError(err instanceof Error ? err.message : "今日选题日报自动生成失败")
      })
      .finally(() => {
        if (!cancelled) setAutoGenerating(false)
      })

    return () => { cancelled = true }
  }, [selectedProjectId, knowledgeLoadedProjectId, loadingKnowledge, knowledgeEntries, topicCards.length])

  function updateForm(category: TopicCategory, field: "title" | "content", value: string) {
    setForms((current) => ({
      ...current,
      [category]: {
        ...current[category],
        [field]: value,
      },
    }))
  }

  function toggleKnowledgeSelection(entryId: string) {
    setSelectedKnowledgeIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId],
    )
  }

  async function handleCreateKnowledge(category: TopicCategory) {
    if (!selectedProjectId) {
      toast.error("先选择一个 IP 营销全案")
      return
    }

    const title = forms[category].title.trim()
    const content = forms[category].content.trim()

    if (!title || !content) {
      toast.error("标题和内容都要填写")
      return
    }

    setSavingCategory(category)
    try {
      const entry = await createKnowledge({
        projectId: selectedProjectId,
        category,
        title,
        content,
        tags: buildDefaultKnowledgeTags(category),
      })
      setKnowledgeEntries((current) => [entry, ...current])
      setSelectedKnowledgeIds((current) => [...new Set([entry.id, ...current])])
      setForms((current) => ({
        ...current,
        [category]: { title: "", content: "" },
      }))
      toast.success("素材已加入选题池")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "素材保存失败")
    } finally {
      setSavingCategory(null)
    }
  }

  async function handleUpdateKnowledge(
    entryId: string,
    data: { title: string; content: string },
  ) {
    const nextTitle = data.title.trim()
    const nextContent = data.content.trim()
    if (!nextTitle || !nextContent) {
      toast.error("标题和内容都不能为空")
      return
    }

    try {
      const updated = await updateKnowledge(entryId, {
        title: nextTitle,
        content: nextContent,
      })
      setKnowledgeEntries((current) =>
        current.map((entry) => (entry.id === entryId ? updated : entry)),
      )
      toast.success("素材已更新")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "素材更新失败")
    }
  }

  async function handleArchiveKnowledge(entryId: string) {
    try {
      await deleteKnowledge(entryId)
      setKnowledgeEntries((current) => current.filter((entry) => entry.id !== entryId))
      setSelectedKnowledgeIds((current) => current.filter((id) => id !== entryId))
      toast.success("素材已归档")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "素材归档失败")
    }
  }

  async function handleGenerateTopics() {
    if (!selectedProjectId) {
      toast.error("先选择一个 IP 营销全案")
      return
    }
    setIsGenerating(true)
    try {
      const result = await generateTopics({
        projectId: selectedProjectId,
        knowledgeEntryIds: generationKnowledgeIds,
        refreshCount: topicRefreshCount,
        recommendationMode,
      })
      setTopicCards(result.cards)
      setAutoGenerateError("")
      setDailyReportSources(result.sourceHighlights ?? [])
      if (recommendationMode === "daily") {
        const briefing = await getTodayAiHotBriefing().catch(() => null)
        setDailyBriefingItems(briefing?.items ?? [])
      } else {
        setDailyBriefingItems([])
        setDailyReportSources([])
      }
      setTopicSelectionId(result.topicSelectionId)
      setSelectedTopicIndex(null)
      setTopicRefreshCount((current) => current + 1)
      toast.success(`已生成 4 个${MODE_META[recommendationMode].label}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "选题生成失败")
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSelectTopic(card: ApiTopicCard, index: number) {
    if (!topicSelectionId) {
      toast.error("当前没有可采用的选题批次")
      return
    }

    try {
      await selectTopic(topicSelectionId, index)
      setSelectedTopicIndex(index)
      toast.success("选题已采用，可继续去 AIM 写文案")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "选题采用失败")
    }
  }

  function jumpToAim(card: ApiTopicCard) {
    const params = new URLSearchParams()
    params.set("agent", "ip_video")
    params.set("mode", "asset_pack")
    params.set("topicTitle", card.title)
    if (card.rationale) params.set("topicRationale", card.rationale)
    if (selectedProjectId) params.set("projectId", selectedProjectId)
    router.push(`/aim?${params.toString()}`)
  }

  const groupedEntries = CATEGORY_ORDER.map((category) => ({
    category,
    items: knowledgeEntries.filter((entry) => entry.category === category),
  }))
  const dailyReport = useMemo(
    () => recommendationMode === "daily" && topicCards.length > 0
      ? buildTopicDailyReport(topicCards, dailyBriefingItems, recommendationMode, dailyReportSources)
      : null,
    [dailyBriefingItems, dailyReportSources, recommendationMode, topicCards],
  )
  const categorizedTopicCards = useMemo(
    () => categorizeTopicCards(topicCards),
    [topicCards],
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <WorkbenchHero
        title="选题中心"
        subtitle="按客户项目沉淀灵感、优质账号参考和用户洞察，再把这些素材稳定变成可拍选题。"
        badge={<Badge variant="secondary">{MODE_META[recommendationMode].label}</Badge>}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/hot-topics" className="block">
          <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/40">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-foreground">热点中心</p>
                <p className="mt-1 text-sm text-muted-foreground">切换 AI HOT、抖音热榜和近30天热点，筛出选题切口。</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/inspiration" className="block">
          <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/40">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-foreground">灵感收集</p>
                <p className="mt-1 text-sm text-muted-foreground">把日常想法、客户问题和素材先收进来。</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <AiResultPanel
        title="我的选题工作台"
        icon={<Target className="h-4 w-4 text-primary" />}
        meta={<span>{MODE_META[recommendationMode].description}</span>}
        contentClassName="flex flex-wrap items-center justify-between gap-3 p-4"
        flat
      >
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(MODE_META).map(([mode, meta]) => (
              <Button
                key={mode}
                size="sm"
                variant={recommendationMode === mode ? "default" : "outline"}
                onClick={() => {
                  setRecommendationMode(mode as ApiTopicRecommendationMode)
                  setTopicCards([])
                  setDailyBriefingItems([])
                  setDailyReportSources([])
                  setTopicSelectionId(null)
                  setSelectedTopicIndex(null)
                }}
              >
                {meta.label}
              </Button>
            ))}
            <Badge variant="outline">{selectedProject ? selectedProject.name : loadingProjects ? "正在读取全案" : "全案配置中"}</Badge>
            <Badge variant="secondary">
              {selectedKnowledgeIds.length > 0 ? `已选素材 ${selectedKnowledgeIds.length} 条` : `素材池 ${knowledgeEntries.length} 条`}
            </Badge>
            <Button
              variant="outline"
              onClick={handleGenerateTopics}
              disabled={!selectedProjectId || isGenerating}
            >
              <Sparkles className="mr-1 h-4 w-4" />
              {isGenerating ? "生成中..." : topicCards.length > 0 ? "重新生成" : `生成${MODE_META[recommendationMode].label}`}
            </Button>
          </div>
      </AiResultPanel>

      {!selectedProjectId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">先选择一个客户项目，再开始沉淀选题素材。</p>
            <p className="mt-1 text-xs text-muted-foreground">
              这一层先解决前台采集和选题生成，避免不同客户的语料混在一起。
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-6">
            <div className="order-2 rounded-xl border bg-muted/20 p-3 text-sm opacity-80">
              <div className="font-medium text-muted-foreground">
                补充素材（可选） · 素材池 {knowledgeEntries.length} 条
              </div>
              <div className="mt-4 space-y-4">
                {groupedEntries.map(({ category, items }) => (
                <Card key={category} className="shadow-none">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle>{CATEGORY_META[category].label}</CardTitle>
                        <CardDescription>{CATEGORY_META[category].description}</CardDescription>
                      </div>
                      <Badge variant="secondary">{items.length} 条</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      <div className="space-y-2">
                        <Label>标题</Label>
                        <Input
                          value={forms[category].title}
                          placeholder={CATEGORY_META[category].titlePlaceholder}
                          onChange={(event) => updateForm(category, "title", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>内容</Label>
                        <Textarea
                          value={forms[category].content}
                          placeholder={CATEGORY_META[category].contentPlaceholder}
                          className="min-h-28"
                          onChange={(event) => updateForm(category, "content", event.target.value)}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleCreateKnowledge(category)}
                          disabled={savingCategory === category}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          {savingCategory === category ? "保存中..." : "加入选题池"}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                      {loadingKnowledge ? (
                        <p className="text-sm text-muted-foreground">正在读取项目素材...</p>
                      ) : items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          这个分类还没有素材，先录一条，后面生成选题时就能直接带进去。
                        </p>
                      ) : (
                        items.map((entry) => (
                          <KnowledgeEntryCard
                            key={entry.id}
                            entry={entry}
                            selected={selectedKnowledgeIds.includes(entry.id)}
                            onToggleSelected={() => toggleKnowledgeSelection(entry.id)}
                            onSave={(data) => handleUpdateKnowledge(entry.id, data)}
                            onArchive={() => handleArchiveKnowledge(entry.id)}
                          />
                        ))
                      )}
                    </div>
                  </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="order-1 space-y-6">
              {dailyReport ? (
                <TopicDailyReportPanel report={dailyReport} />
              ) : recommendationMode === "daily" ? (
                <TopicDailyReportEmptyState
                  error={autoGenerateError}
                  onGenerate={handleGenerateTopics}
                  disabled={!selectedProjectId || isGenerating || autoGenerating}
                />
              ) : null}

              <AiResultPanel
                title="推荐选题"
                icon={<Sparkles className="h-4 w-4 text-primary" />}
                meta={<span>选择一个方向，进入 AIM 写文案。</span>}
                flat
              >
                  <div className="flex flex-wrap gap-2">
                    {selectedKnowledgeIds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        未手动选择素材，将自动结合热点、对标账号、拆解文案和素材池 {knowledgeEntries.length} 条。
                      </p>
                    ) : (
                      selectedKnowledgeIds.map((entryId) => {
                        const entry = knowledgeEntries.find((item) => item.id === entryId)
                        if (!entry) return null
                        return (
                          <Badge key={entry.id} variant="outline">
                            {CATEGORY_META[entry.category as TopicCategory]?.label ?? "素材"} · {entry.title}
                          </Badge>
                        )
                      })
                    )}
                  </div>

                  {autoGenerating ? (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在生成今日推荐选题…
                    </div>
                  ) : topicCards.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      暂无推荐选题。
                    </div>
                  ) : (
                      <div className="space-y-5">
                        {categorizedTopicCards.map((group) => (
                          <div key={group.key}>
                            <div className="mb-2 flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{group.label}</span>
                              <Badge variant="secondary" className="text-[11px]">{group.cards.length}</Badge>
                            </div>
                            <div className="space-y-3">
                              {group.cards.map((card) => {
                                const index = topicCards.indexOf(card)
                                const isSelected = selectedTopicIndex === index
                                return (
                                  <div
                                    key={`${card.title}-${index}`}
                                    className="rounded-xl border border-primary/10 bg-card p-4 shadow-sm"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge variant="secondary">#{index + 1}</Badge>
                                          {isSelected && <Badge>已采用</Badge>}
                                          {card.topicType && <Badge variant="outline">{card.topicType}</Badge>}
                                          {card.sourceType && <Badge variant="outline">{card.sourceType}</Badge>}
                                          {typeof card.score === "number" && <Badge variant="outline">{card.score}分</Badge>}
                                          {card.contentLine && (
                                            <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
                                              {card.contentLine}
                                            </Badge>
                                          )}
                                          {card.reviewVerdict && (
                                            <Badge variant="outline" className={VERDICT_META[card.reviewVerdict].className}>
                                              {VERDICT_META[card.reviewVerdict].label}
                                            </Badge>
                                          )}
                                          {card.defamiliarization?.scarcityType && (
                                            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                                              {SCARCITY_BADGE[card.defamiliarization.scarcityType] ?? card.defamiliarization.scarcityType}
                                            </Badge>
                                          )}
                                          {card.defamiliarization?.rhetoric && (
                                            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                                              {RHETORIC_BADGE[card.defamiliarization.rhetoric] ?? card.defamiliarization.rhetoric}
                                            </Badge>
                                          )}
                                        </div>
                                        <h3 className="text-base font-semibold">{card.title}</h3>
                                        {card.rationale ? (
                                          <p className="text-sm text-muted-foreground">{card.rationale}</p>
                                        ) : null}
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        {isSelected ? (
                                          <Button onClick={() => jumpToAim(card)}>
                                            <Send className="mr-1 h-4 w-4" />
                                            去 AIM 写文案
                                          </Button>
                                        ) : (
                                          <Button
                                            variant="outline"
                                            onClick={() => handleSelectTopic(card, index)}
                                            disabled={selectedTopicIndex !== null}
                                          >
                                            <Check className="mr-1 h-4 w-4" />
                                            采用这个选题
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    {card.scoreBreakdown ? (
                                      <div className="mt-4 space-y-2 rounded-lg bg-muted/30 p-3">
                                        <div className="grid gap-2 sm:grid-cols-5">
                                          {scoreEntries(card).map((entry) => (
                                            <div key={entry.key} className="space-y-1">
                                              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                                <span>{entry.label}</span>
                                                <span>{entry.value}</span>
                                              </div>
                                              <div className="h-1.5 rounded-full bg-muted">
                                                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${entry.value}%` }} />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        {(() => {
                                          const summary = strongestAndWeakest(card)
                                          return summary ? (
                                            <p className="text-xs text-muted-foreground">
                                              强项：{summary.strongest.label}；短板：{summary.weakest.label}。
                                              {card.revisionAdvice ? ` ${card.revisionAdvice}` : ""}
                                            </p>
                                          ) : null
                                        })()}
                                      </div>
                                    ) : null}
                                    {card.defamiliarization ? (() => {
                                      const df = card.defamiliarization
                                      const score = typeof df.noveltyScore === "number" ? df.noveltyScore : null
                                      const low = score !== null && score < NOVELTY_LOW
                                      const barColor = score === null
                                        ? "bg-muted-foreground"
                                        : score >= NOVELTY_HIGH
                                          ? "bg-emerald-500"
                                          : low
                                            ? "bg-rose-500"
                                            : "bg-amber-500"
                                      const levelLabel =
                                        score === null
                                          ? "未评分"
                                          : score >= NOVELTY_HIGH
                                            ? "高含金量"
                                            : low
                                              ? "含金量偏低"
                                              : "中等"
                                      return (
                                        <div className={`mt-2 space-y-2 rounded-lg border p-3 ${low ? "border-rose-200 bg-rose-50/40" : "bg-muted/20"}`}>
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-medium text-muted-foreground">陌生化含金量 · {levelLabel}</span>
                                            {score !== null && <span className={`text-[11px] ${low ? "text-rose-600" : "text-muted-foreground"}`}>{score}</span>}
                                          </div>
                                          {score !== null && (
                                            <div className="h-1.5 rounded-full bg-muted">
                                              <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${score}%` }} />
                                            </div>
                                          )}
                                          {df.note ? (
                                            <p className="text-xs text-muted-foreground">凭什么陌生：{df.note}</p>
                                          ) : null}
                                          {df.advice ? (
                                            <p className={`text-xs ${low ? "text-rose-600" : "text-muted-foreground"}`}>{df.advice}</p>
                                          ) : null}
                                        </div>
                                      )
                                    })() : null}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
              </AiResultPanel>

            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TopicDailyReportEmptyState({
  error,
  onGenerate,
  disabled,
}: {
  error: string
  onGenerate: () => void
  disabled: boolean
}) {
  return (
    <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>选题日报</Badge>
          <Badge variant="outline">待生成</Badge>
        </div>
        <div>
          <CardTitle className="text-xl leading-tight">今日选题日报还没生成</CardTitle>
          <CardDescription className="mt-2 text-sm leading-6">
            点击「生成选题日报」，系统会优先借助对标账号和拆解文案，结合项目资料生成主推方向；AI HOT 只做辅助热点参考。
          </CardDescription>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
        <Button className="w-fit" onClick={onGenerate} disabled={disabled}>
          <Sparkles className="mr-1 h-4 w-4" />
          生成选题日报
        </Button>
      </CardHeader>
    </Card>
  )
}

function TopicDailyReportPanel({ report }: { report: TopicDailyReport }) {
  async function copyAction() {
    try {
      await navigator.clipboard.writeText(report.copyText)
      toast.success("今日行动已复制")
    } catch {
      toast.error("复制失败，请手动复制")
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>今日选题日报</Badge>
        </div>
        <div>
          <CardTitle className="text-xl leading-tight">今日主编判断</CardTitle>
          <CardDescription className="mt-2 text-sm leading-6">
            {report.editorJudgment}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">今天只打这一枪</h3>
            <Badge variant="secondary">{report.leadCard?.topicType ?? "主推"}</Badge>
          </div>
          <div className="space-y-3 text-sm leading-6">
            <div>
              <b className="text-muted-foreground">为什么值</b>
              <p>{report.decision.why}</p>
            </div>
            <div>
              <b className="text-muted-foreground">边界</b>
              <p>{report.decision.boundary}</p>
            </div>
            <div>
              <b className="text-muted-foreground">承接动作</b>
              <p>{report.decision.action}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">今日线索管线</h3>
            <Badge variant="outline">{report.signals.length} 条</Badge>
          </div>
          <div className="grid gap-2">
            {report.signals.map((signal, index) => (
              <div key={`${signal.rank}-${signal.title}-${index}`} className="rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={signal.rank === "S" ? "default" : "outline"}>
                    {signal.rank} {signal.label}
                  </Badge>
                  {signal.source ? <span className="text-xs text-muted-foreground">{signal.source}</span> : null}
                </div>
                <p className="mt-2 text-sm font-semibold leading-5">{signal.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.summary}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold">选题工坊</h3>
          <div className="grid gap-2">
            {report.workshop.map((topic) => (
              <div key={`${topic.index}-${topic.title}`} className="rounded-lg border bg-background p-3">
                <Badge variant="secondary">#{topic.index}</Badge>
                <p className="mt-2 text-sm font-semibold leading-5">{topic.title}</p>
                <div className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
                  <p><b>开头：</b>{topic.hook}</p>
                  <p><b>角度：</b>{topic.angle}</p>
                  <p><b>CTA：</b>{topic.cta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold">平台打法</h3>
          <div className="grid gap-2">
            {report.platforms.map((platform) => (
              <div key={platform.name} className="rounded-lg border bg-background p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{platform.name}</Badge>
                  <p className="text-sm font-semibold">{platform.title}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{platform.structure}</p>
              </div>
            ))}
          </div>
        </div>

        {report.evidence.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-base font-semibold">来源证据台</h3>
            <div className="grid gap-2">
              {report.evidence.map((item) => (
                <div key={item.url} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.status}</Badge>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      <span className="truncate">{item.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.source} · {item.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border bg-foreground p-4 text-background">
          <p className="text-sm leading-6">{report.copyText}</p>
          <Button className="mt-3" variant="secondary" onClick={copyAction}>
            <Clipboard className="h-4 w-4" />
            复制今日行动
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function KnowledgeEntryCard({
  entry,
  selected,
  onToggleSelected,
  onSave,
  onArchive,
}: {
  entry: KnowledgeEntry
  selected: boolean
  onToggleSelected: () => void
  onSave: (data: { title: string; content: string }) => Promise<void>
  onArchive: () => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(entry.title)
  const [draftContent, setDraftContent] = useState(entry.content)
  const [isSaving, setIsSaving] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    try {
      await onSave({ title: draftTitle, content: draftContent })
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleArchive() {
    setIsArchiving(true)
    try {
      await onArchive()
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border"
            checked={selected}
            onChange={onToggleSelected}
          />
          <div className="space-y-1">
            {isEditing ? (
              <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            ) : (
              <p className="text-sm font-semibold">{entry.title}</p>
            )}
            <p className="text-xs text-muted-foreground">录入于 {formatDate(entry.createdAt)}</p>
          </div>
        </label>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setDraftTitle(entry.title)
                setDraftContent(entry.content)
                setIsEditing(true)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" onClick={handleArchive} disabled={isArchiving}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {isEditing ? (
          <Textarea
            value={draftContent}
            className="min-h-28"
            onChange={(event) => setDraftContent(event.target.value)}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {entry.content}
          </p>
        )}
      </div>
    </div>
  )
}
