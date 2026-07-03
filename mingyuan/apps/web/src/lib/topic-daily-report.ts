import type { ApiAiHotBriefingItem, ApiTopicCard, ApiTopicRecommendationMode } from "@/types/api"

export type TopicSignalRank = "S" | "A" | "B" | "C"
export interface TopicDailyReportSource {
  category: string
  title: string
  content: string
}

export interface TopicDailyReport {
  leadCard: ApiTopicCard | null
  editorJudgment: string
  decision: {
    why: string
    boundary: string
    action: string
  }
  signals: Array<{
    rank: TopicSignalRank
    label: string
    title: string
    summary: string
    source?: string
    url?: string
  }>
  workshop: Array<{
    index: number
    title: string
    hook: string
    angle: string
    cta: string
  }>
  platforms: Array<{
    name: "小红书" | "公众号" | "短视频"
    title: string
    structure: string
  }>
  evidence: Array<{
    title: string
    source: string
    summary: string
    url: string
    status: string
    suggestion: string
  }>
  copyText: string
}

function scoreOf(card: ApiTopicCard) {
  return typeof card.score === "number" ? card.score : 0
}

function getLeadCard(cards: ApiTopicCard[]) {
  return [...cards].sort((a, b) => scoreOf(b) - scoreOf(a))[0] ?? null
}

function fallbackHook(card: ApiTopicCard) {
  return card.hook || card.rationale || `今天这条内容可以从「${card.title}」切入。`
}

function fallbackAngle(card: ApiTopicCard) {
  return card.angle || card.scoreReason || "先讲用户当下最关心的问题，再落到可执行的业务动作。"
}

function fallbackCta(card: ApiTopicCard) {
  return card.cta || "评论或私信关键词，领取相关检查表或进一步咨询。"
}

const SCORE_LABELS: Record<keyof NonNullable<ApiTopicCard["scoreBreakdown"]>, string> = {
  projectFit: "项目匹配",
  contentValue: "内容价值",
  viralHook: "传播钩子",
  conversionFit: "成交关联",
  feasibility: "可执行性",
}

function scoreDecisionReason(card: ApiTopicCard | null) {
  if (!card?.scoreBreakdown) return card?.rationale || card?.scoreReason || "它和当前项目资料、内容目的和执行条件最匹配。"
  const entries = (Object.keys(card.scoreBreakdown) as Array<keyof NonNullable<ApiTopicCard["scoreBreakdown"]>>)
    .map((key) => ({ key, value: card.scoreBreakdown![key] }))
    .sort((a, b) => b.value - a.value)
  const strongest = entries[0]
  const weakest = entries[entries.length - 1]
  return `总分 ${card.score ?? 0}，强项是${SCORE_LABELS[strongest.key]}，短板是${SCORE_LABELS[weakest.key]}。${card.scoreReason || card.rationale || ""}`
}

function rankForIndex(index: number): TopicSignalRank {
  if (index === 0) return "S"
  if (index <= 3) return "A"
  if (index <= 6) return "B"
  return "C"
}

function signalLabel(rank: TopicSignalRank) {
  const labels: Record<TopicSignalRank, string> = {
    S: "主菜",
    A: "侧翼",
    B: "观察",
    C: "降权",
  }
  return labels[rank]
}

function sourceLabel(category: string) {
  if (category === "industry_hot") return "辅助热点"
  if (category === "benchmark_reference") return "对标"
  if (category === "client_project") return "全案"
  return "素材"
}

function buildSignals(items: ApiAiHotBriefingItem[], sources: TopicDailyReportSource[], leadCard: ApiTopicCard | null) {
  const sourceSignals = sources
    .filter((source) => source.category === "benchmark_reference")
    .slice(0, 4)
    .map((source) => ({
      title: source.title,
      summary: source.content,
      source: sourceLabel(source.category),
    }))

  const hotSignals = items.slice(0, 8).map((item) => ({
    title: item.title,
    summary: item.summary,
    source: item.source,
    url: typeof item.url === "string" ? item.url : undefined,
  }))

  const combined = [...sourceSignals, ...hotSignals]
  if (combined.length > 0) {
    return combined.slice(0, 8).map((item, index) => {
      const rank = rankForIndex(index)
      return {
        rank,
        label: signalLabel(rank),
        title: item.title,
        summary: item.summary,
        source: item.source,
        url: "url" in item && typeof item.url === "string" ? item.url : undefined,
      }
    })
  }

  if (!leadCard) return []
  return [{
    rank: "S" as const,
    label: "主菜",
    title: leadCard.title,
    summary: leadCard.rationale || leadCard.scoreReason || "基于当前选题卡生成的今日主推方向。",
  }]
}

function buildPlatforms(leadCard: ApiTopicCard | null) {
  const title = leadCard?.title || "今日主选题"
  const hook = leadCard ? fallbackHook(leadCard) : "先抓住用户今天最关心的问题。"
  const angle = leadCard ? fallbackAngle(leadCard) : "围绕痛点、判断和行动建议展开。"

  return [
    {
      name: "小红书" as const,
      title,
      structure: `${hook} 三段式展开：痛点、方法、适合谁。`,
    },
    {
      name: "公众号" as const,
      title: `${title}：从一个热点看内容生产判断`,
      structure: `${angle} 用案例和边界补足可信度。`,
    },
    {
      name: "短视频" as const,
      title,
      structure: "5 秒痛点开场，30 秒讲核心判断，10 秒给行动建议和 CTA。",
    },
  ]
}

function buildEvidence(items: ApiAiHotBriefingItem[], sources: TopicDailyReportSource[]) {
  const benchmarkEvidence = sources
    .filter((source) => source.category === "benchmark_reference")
    .slice(0, 4)
    .map((source) => ({
      title: source.title,
      source: "对标视频/拆解文案",
      summary: source.content,
      url: "",
      status: "已入库",
      suggestion: "优先拆它的钩子、结构和选题角度，不照搬标题。",
    }))

  const hotEvidence = items.slice(0, 4).map((item, index) => ({
    title: item.title,
    source: `辅助热点｜${item.source}`,
    summary: item.summary,
    url: item.url,
    status: index <= 2 ? "可验证" : "待观察",
    suggestion: index <= 2 ? "正文优先引用原始来源，再加自己的业务判断。" : "先放观察区，等实测或官方案例补充后再主推。",
  }))

  return [...benchmarkEvidence, ...hotEvidence].slice(0, 8)
}

export function buildTopicDailyReport(
  cards: ApiTopicCard[],
  briefingItems: ApiAiHotBriefingItem[],
  mode: ApiTopicRecommendationMode,
  sources: TopicDailyReportSource[] = [],
): TopicDailyReport {
  const leadCard = getLeadCard(cards)
  const leadTitle = leadCard?.title || "今日主选题"
  const leadCta = leadCard ? fallbackCta(leadCard) : "先生成今日推荐，再进入 AIM 写文案。"
  const signals = buildSignals(briefingItems, sources, leadCard)

  return {
    leadCard,
    editorJudgment: mode === "daily"
      ? `今天先围绕「${leadTitle}」做主推，不铺开追所有热点。`
      : `当前最值得优先推进的是「${leadTitle}」。`,
    decision: {
      why: scoreDecisionReason(leadCard),
      boundary: "不要把观察中的热点讲成稳定结论，优先保留来源和使用边界。",
      action: leadCta,
    },
    signals,
    workshop: cards.slice(0, 4).map((card, index) => ({
      index: index + 1,
      title: card.title,
      hook: fallbackHook(card),
      angle: fallbackAngle(card),
      cta: fallbackCta(card),
    })),
    platforms: buildPlatforms(leadCard),
    evidence: buildEvidence(briefingItems, sources),
    copyText: `今日行动：主发「${leadTitle}」；${leadCta}`,
  }
}
