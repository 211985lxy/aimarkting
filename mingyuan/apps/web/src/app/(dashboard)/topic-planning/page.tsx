"use client"

import { useEffect, useState, startTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Layers,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createKnowledge,
  deleteKnowledge,
  generateTopics,
  listClientProjects,
  listCopyStructures,
  listKnowledge,
  listOpeningTypes,
  selectTopic,
  updateKnowledge,
  type ClientProject,
  type KnowledgeEntry,
} from "@/lib/api/client"
import type { ApiTopicCard } from "@/types/api"

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
    label: "对标参考",
    description: "人工粘贴对标账号链接、爆款标题、开头方式或结构拆解。",
    titlePlaceholder: "例如：某对标账号爆款开头",
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

const fourCards = [
  {
    title: "热度卡",
    icon: TrendingUp,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    desc: "看素材和当前市场之间有没有时机感。",
  },
  {
    title: "匹配卡",
    icon: Target,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    desc: "看这个方向和客户项目、业务目标是否真正匹配。",
  },
  {
    title: "差异卡",
    icon: Zap,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    desc: "看对标已经讲到哪里，你还能从哪里切进去。",
  },
  {
    title: "可行卡",
    icon: Layers,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    desc: "看当下素材、案例、拍摄条件是否足够支撑成片。",
  },
]

const twelveElements = [
  "痛点共鸣",
  "反常识冲击",
  "数字背书",
  "场景还原",
  "对比冲突",
  "权威借力",
  "情感钩子",
  "时效热点",
  "案例故事",
  "悬念设置",
  "实用价值",
  "社交货币",
]

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  })
}

function formatTopicCardLabel(
  code: string,
  mapping: Record<string, string>,
  fallbackPrefix: string,
) {
  return mapping[code] ?? `${fallbackPrefix} · ${code}`
}

export default function TopicPlanningPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([])
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingKnowledge, setLoadingKnowledge] = useState(false)
  const [savingCategory, setSavingCategory] = useState<TopicCategory | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [topicCards, setTopicCards] = useState<ApiTopicCard[]>([])
  const [topicSelectionId, setTopicSelectionId] = useState<string | null>(null)
  const [selectedTopicIndex, setSelectedTopicIndex] = useState<number | null>(null)
  const [topicRefreshCount, setTopicRefreshCount] = useState(0)
  const [openingTypeMap, setOpeningTypeMap] = useState<Record<string, string>>({})
  const [structureMap, setStructureMap] = useState<Record<string, string>>({})
  const [forms, setForms] = useState<Record<TopicCategory, { title: string; content: string }>>({
    daily_inspiration: { title: "", content: "" },
    benchmark_reference: { title: "", content: "" },
    user_insight: { title: "", content: "" },
  })

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null

  useEffect(() => {
    Promise.all([listClientProjects(), listOpeningTypes(), listCopyStructures()])
      .then(([projectData, openingTypes, copyStructures]) => {
        setProjects(projectData)
        setOpeningTypeMap(
          Object.fromEntries(openingTypes.map((item) => [item.code, item.name])),
        )
        setStructureMap(
          Object.fromEntries(copyStructures.map((item) => [item.code, item.name])),
        )
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
        setTopicCards([])
        setTopicSelectionId(null)
        setSelectedTopicIndex(null)
        setTopicRefreshCount(0)
      })
      return
    }

    startTransition(() => setLoadingKnowledge(true))
    listKnowledge({ projectId: selectedProjectId, status: "active" })
      .then((entries) => {
        setKnowledgeEntries(entries)
        setSelectedKnowledgeIds([])
        setTopicCards([])
        setTopicSelectionId(null)
        setSelectedTopicIndex(null)
        setTopicRefreshCount(0)
      })
      .catch(() => toast.error("项目素材读取失败，请稍后重试"))
      .finally(() => setLoadingKnowledge(false))
  }, [selectedProjectId])

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
    if (selectedKnowledgeIds.length === 0) {
      toast.error("至少选择 1 条素材再生成选题")
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateTopics({
        projectId: selectedProjectId,
        knowledgeEntryIds: selectedKnowledgeIds,
        refreshCount: topicRefreshCount,
      })
      setTopicCards(result.cards)
      setTopicSelectionId(result.topicSelectionId)
      setSelectedTopicIndex(null)
      setTopicRefreshCount((current) => current + 1)
      toast.success("已生成 4 个选题方向")
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
    params.set("topicTitle", card.title)
    if (card.rationale) params.set("topicRationale", card.rationale)
    if (selectedProjectId) params.set("projectId", selectedProjectId)
    router.push(`/aim?${params.toString()}`)
  }

  const groupedEntries = CATEGORY_ORDER.map((category) => ({
    category,
    items: knowledgeEntries.filter((entry) => entry.category === category),
  }))

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <PageHeader
        title="选题策划官"
        subtitle="按客户项目沉淀灵感、对标和用户洞察，再把这些素材稳定变成可拍选题。"
      />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>项目工作台</CardTitle>
          <CardDescription>第一版先把前台入口跑通，后台知识库整理后续再接。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="project-select">选择 IP 营销全案</Label>
            <Select value={selectedProjectId} onValueChange={(value) => setSelectedProjectId(value ?? "")}>
              <SelectTrigger id="project-select">
                <SelectValue placeholder={loadingProjects ? "正在读取项目..." : "请选择一个客户项目"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{selectedProject ? selectedProject.name : "未选择项目"}</Badge>
            <Badge variant="secondary">已选素材 {selectedKnowledgeIds.length} 条</Badge>
            <Button
              variant="outline"
              onClick={handleGenerateTopics}
              disabled={!selectedProjectId || selectedKnowledgeIds.length === 0 || isGenerating}
            >
              <Sparkles className="mr-1 h-4 w-4" />
              {isGenerating ? "生成中..." : topicCards.length > 0 ? "换一组选题" : "生成选题"}
            </Button>
          </div>
        </CardContent>
      </Card>

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
          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-6">
              {groupedEntries.map(({ category, items }) => (
                <Card key={category}>
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

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>当前选题批次</CardTitle>
                  <CardDescription>
                    基于你勾选的素材生成 4 张选题卡，确认后再进入 AIM 写文案。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedKnowledgeIds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">还没勾选素材。至少选 1 条再生成。</p>
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

                  {topicCards.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      选题卡还没生成。先勾选素材，再点「生成选题」。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topicCards.map((card, index) => {
                        const isSelected = selectedTopicIndex === index
                        return (
                          <div
                            key={`${card.title}-${index}`}
                            className="rounded-xl border bg-card p-4 shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">#{index + 1}</Badge>
                                  {isSelected && <Badge>已采用</Badge>}
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
                            <div className="mt-3 flex flex-wrap gap-2">
                              {card.elementCodes.map((code) => (
                                <Badge key={code} variant="outline">
                                  元素 · {code}
                                </Badge>
                              ))}
                              <Badge variant="outline">
                                开头 · {formatTopicCardLabel(card.openingTypeCode, openingTypeMap, "开头")}
                              </Badge>
                              <Badge variant="outline">
                                结构 · {formatTopicCardLabel(card.structureCode, structureMap, "结构")}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>四卡片评估体系</CardTitle>
                  <CardDescription>前台先把素材进来，判断仍然按这四个维度收束。</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {fourCards.map((card) => (
                    <div key={card.title} className={`rounded-xl border p-4 ${card.borderColor}`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bgColor}`}>
                          <card.icon className={`h-4 w-4 ${card.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{card.title}</p>
                          <p className="text-xs text-muted-foreground">{card.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>12 元素模型</CardTitle>
                  <CardDescription>选题卡仍然复用现有 12 元素引擎，不另起一套规则。</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {twelveElements.map((item, index) => (
                    <Badge key={item} variant="outline">
                      {index + 1}. {item}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
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
