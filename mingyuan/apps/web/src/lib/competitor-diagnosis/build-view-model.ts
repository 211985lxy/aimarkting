import type { ApiCompetitorAnalysis } from "@/types/api"
import type {
  CompetitorDiagnosisViewModel,
  ConfidenceLevel,
  DiagnosisQuestion,
  FalsificationRow,
  StrategicBet,
  VerdictData,
  ContentStrategyData,
  EvidenceData,
} from "./types"

// ─── Confidence Calculator ───────────────────────────────

export function calcConfidence(
  videoCount: number | null | undefined,
  hasMetrics: boolean,
  hasContentStrategy: boolean,
  hasTopVideos: boolean,
  isMonetization: boolean = false,
): ConfidenceLevel {
  if (isMonetization) {
    return hasContentStrategy ? "中" : "低"
  }
  if (videoCount != null && videoCount >= 20 && hasMetrics && hasTopVideos) return "高"
  if (videoCount != null && videoCount >= 10 && (hasTopVideos || hasContentStrategy)) return "中高"
  if (hasContentStrategy) return "中"
  return "低"
}

// ─── Asset Grade ─────────────────────────────────────────

function assetGrade(score: number): string {
  if (score >= 85) return "S 级 IP 资产"
  if (score >= 75) return "A 级 IP 资产"
  if (score >= 60) return "B 级 IP 资产"
  if (score >= 45) return "C 级潜力资产"
  return "D 级待观察"
}

// ─── One-Line Verdict Builder ────────────────────────────

function buildOneLineVerdict(analysis: ApiCompetitorAnalysis): string {
  const r = analysis.analysisResult
  if (!r) return "数据不足，无法生成判断。"

  const { sections, scores } = r
  const accountType = sections?.account_overview?.account_type ?? "未知类型"
  const vertical = sections?.account_overview?.content_vertical ?? ""
  const topScore = Math.max(
    scores?.content_power ?? 0,
    scores?.engagement_power ?? 0,
    scores?.persona_power ?? 0,
  )
  const topDim =
    topScore === (scores?.content_power ?? 0)
      ? "高密度内容能力"
      : topScore === (scores?.engagement_power ?? 0)
        ? "强互动社区"
        : "鲜明人设心智"

  return `这是一个${accountType}${vertical ? `（${vertical}）` : ""}IP，资产价值主要来自${topDim}。`
}

// ─── Verdict Builder ─────────────────────────────────────

function buildVerdict(analysis: ApiCompetitorAnalysis): VerdictData {
  const r = analysis.analysisResult
  const sections = r?.sections
  const scores = r?.scores
  const videoCount = analysis.videoCount
  const hasMetrics = !!analysis.metricsData
  const hasContentStrategy = !!(sections?.content_strategy?.topic_distribution?.length)

  const assetParts: string[] = []
  if (sections?.account_overview?.positioning) assetParts.push(sections.account_overview.positioning)
  if (scores && scores.content_power >= 70) assetParts.push("内容力突出")
  if (scores && scores.persona_power >= 70) assetParts.push("人设辨识度高")
  const assetVerdict = assetParts.length > 0 ? assetParts.join("，") : "数据不足以判断核心资产"

  const growthDrivers = sections?.growth_analysis?.growth_drivers ?? []
  const growthVerdict =
    growthDrivers.length > 0
      ? growthDrivers[0]
      : scores && scores.growth_power >= 60
        ? "稳定内容供给驱动增长"
        : "增长驱动力不明确"

  const risks = sections?.recommendations?.risks ?? []
  const riskVerdict =
    risks.length > 0
      ? risks[0]
      : scores && scores.monetization_power < 50
        ? "变现路径不清晰，商业转化可能弱"
        : "风险数据不足"

  const confidence = calcConfidence(videoCount, hasMetrics, hasContentStrategy, !!r?.stats?.top_videos?.length)

  return { assetVerdict, growthVerdict, riskVerdict, confidence }
}

// ─── Five-Layer Diagnosis Builder ────────────────────────

function buildDiagnosisQuestions(analysis: ApiCompetitorAnalysis): DiagnosisQuestion[] {
  const r = analysis.analysisResult
  const sections = r?.sections
  const scores = r?.scores
  const videoCount = analysis.videoCount
  const hasMetrics = !!analysis.metricsData
  const hasTopVideos = !!r?.stats?.top_videos?.length
  const hasContentStrategy = !!(sections?.content_strategy?.topic_distribution?.length)

  const baseConfidence = calcConfidence(videoCount, hasMetrics, hasContentStrategy, hasTopVideos)

  return [
    {
      questionNo: 1,
      layerName: "定位心智层",
      coreQuestion: "这个账号服务谁？用户为什么记住它？",
      oneLineConclusion: sections?.account_overview?.positioning
        ?? (sections?.account_overview?.account_type
          ? `定位为${sections.account_overview.account_type}，但差异化表达不够清晰`
          : "定位信息缺失，无法判断心智沉淀"),
      confidence: baseConfidence,
      evidenceSource: [
        "账号签名与简介",
        "话题分布占比",
        "钩子模式一致性",
        "Top 视频主题集中度",
      ],
      bodySections: [
        sections?.account_overview?.account_type ? `账号类型：${sections.account_overview.account_type}` : null,
        sections?.account_overview?.content_vertical ? `内容垂类：${sections.account_overview.content_vertical}` : null,
        sections?.account_overview?.differentiator ? `差异化优势：${sections.account_overview.differentiator}` : null,
      ].filter((v): v is string => v !== null),
      keyCharts: ["话题分布", "Top 视频主题"],
      falsificationTable: [
        {
          claim: "账号有清晰定位心智",
          couldBeWrongIf: "爆款视频主题分散，没有统一主线",
          verifyBy: "检查 Top 10 视频是否属于同一主题方向",
          correctionSignal: "Top 视频分属 3 个以上不同方向",
          misjudgeCost: "误判定位清晰度，导致对标方向偏差",
        },
        {
          claim: "用户记住了这个账号的能力",
          couldBeWrongIf: "评论只讨论单条内容，不提账号能力",
          verifyBy: "分析评论中是否出现对账号本身的评价",
          correctionSignal: "评论几乎不提及账号名或能力标签",
          misjudgeCost: "高估心智沉淀，复制定位效果差",
        },
      ],
      actionSuggestion: "固化一句账号定位表达，确保简介、钩子、内容主题三者一致。",
    },
    {
      questionNo: 2,
      layerName: "内容增长层",
      coreQuestion: "为什么能涨？增长是否可复制？",
      oneLineConclusion: scores && scores.content_power >= 60
        ? `内容力${scores.content_power >= 80 ? "强" : "中等"}，${sections?.content_strategy?.viral_formula ? `爆款公式：${sections.content_strategy.viral_formula}` : "爆款模式可识别"}`
        : "内容增长力偏弱，缺乏可复制的爆款模式",
      confidence: baseConfidence,
      evidenceSource: [
        "话题分布",
        "内容形式占比",
        "发布频率",
        "爆款公式",
        "Top 视频表现",
        "平均每周发布量",
      ],
      bodySections: [
        sections?.content_strategy?.posting_frequency ? `发布频率：${sections.content_strategy.posting_frequency}` : null,
        sections?.content_strategy?.viral_formula ? `爆款公式：${sections.content_strategy.viral_formula}` : null,
        sections?.growth_analysis?.growth_trend ? `增长趋势：${sections.growth_analysis.growth_trend}` : null,
        analysis.metricsData?.publishing?.avg_per_week
          ? `平均每周发布：${analysis.metricsData.publishing.avg_per_week} 条`
          : null,
      ].filter((v): v is string => v !== null),
      keyCharts: ["话题分布", "内容形式", "Top 视频排行", "发布时间热力图"],
      falsificationTable: [
        {
          claim: "增长来自可复制的内容方法",
          couldBeWrongIf: "增长主要来自单条热点视频，不是系统性方法",
          verifyBy: "对比 Top 3 视频与平均视频的互动差距",
          correctionSignal: "Top 1 互动是均值的 5 倍以上",
          misjudgeCost: "误判增长可复制性，盲目模仿后无效果",
        },
        {
          claim: "当前发布节奏可持续",
          couldBeWrongIf: "高频发布带来互动，但生产成本不可持续",
          verifyBy: "对比发布频率与内容形式（深度 vs 轻量）",
          correctionSignal: "深度内容占比高但频率也高，可能疲劳",
          misjudgeCost: "高估产能可持续性",
        },
      ],
      actionSuggestion: "保留高价值教程/分析主线，减少随机内容，固化爆款公式。",
    },
    {
      questionNo: 3,
      layerName: "信任需求层",
      coreQuestion: "为什么能信？用户到底想解决什么问题？",
      oneLineConclusion: scores && scores.engagement_power >= 60
        ? `互动率${scores.engagement_power >= 80 ? "高" : "中等"}，${sections?.engagement_analysis?.comment_quality ? `评论质量：${sections.engagement_analysis.comment_quality}` : "用户有主动反馈"}`
        : "互动数据偏弱，信任建立证据不足",
      confidence: calcConfidence(videoCount, hasMetrics, hasContentStrategy, hasTopVideos),
      evidenceSource: [
        "评论质量分析",
        "钩子模式",
        "高互动视频主题",
        "平均互动率",
        "点赞评论比",
      ],
      bodySections: [
        ...(sections?.engagement_analysis?.comment_quality ? [`评论质量：${sections.engagement_analysis.comment_quality}`] : []),
        ...(sections?.engagement_analysis?.anomaly_detection ? [`异常检测：${sections.engagement_analysis.anomaly_detection}`] : []),
        ...(analysis.metricsData?.engagement?.like_to_comment_ratio ? [`点赞评论比：${analysis.metricsData.engagement.like_to_comment_ratio.toFixed(1)}`] : []),
      ],
      keyCharts: ["平均互动指标", "Top 视频互动率", "评论质量"],
      falsificationTable: [
        {
          claim: "高互动 = 信任建立",
          couldBeWrongIf: "点赞高但评论低，可能只是信息消费不是信任",
          verifyBy: "检查收藏/转发数据和评论深度",
          correctionSignal: "点赞高但评论率和转发率都低",
          misjudgeCost: "高估信任深度，转化动作无效",
        },
        {
          claim: "用户有明确需求场景",
          couldBeWrongIf: "评论以泛泛夸赞为主，没有具体问题",
          verifyBy: "分析评论中是否出现具体问题或求助",
          correctionSignal: "评论以泛泛夸赞为主，无具体需求",
          misjudgeCost: "错估用户需求，产品/服务不匹配",
        },
      ],
      actionSuggestion: "增加案例、过程、结果证据类内容，引导用户表达具体需求。",
    },
    {
      questionNo: 4,
      layerName: "商业转化层",
      coreQuestion: "为什么能卖？变现链路是否健康？",
      oneLineConclusion: scores && scores.monetization_power >= 60
        ? `变现力${scores.monetization_power >= 80 ? "强" : "中等"}，${sections?.monetization_analysis?.monetization_paths?.length ? `路径：${sections.monetization_analysis.monetization_paths.join("、")}` : "有变现迹象"}`
        : "变现力偏弱，商业转化链路不清晰（间接推断）",
      confidence: calcConfidence(videoCount, hasMetrics, hasContentStrategy, hasTopVideos, true),
      evidenceSource: [
        "变现路径推断",
        "产品品类推断",
        "账号签名/简介",
        "内容中的 CTA 痕迹",
      ],
      bodySections: [
        ...(sections?.monetization_analysis?.monetization_paths?.map(p => `变现路径：${p}`) ?? []),
        ...(sections?.monetization_analysis?.product_categories?.map(c => `产品品类：${c}`) ?? []),
        ...(sections?.monetization_analysis?.estimated_revenue_level ? [`预估收益水平：${sections.monetization_analysis.estimated_revenue_level}`] : []),
        "以上变现判断基于公开内容推断，非真实成交数据",
      ],
      keyCharts: ["变现路径", "产品品类"],
      falsificationTable: [
        {
          claim: "账号有变现能力",
          couldBeWrongIf: "没有明确产品入口或私域承接",
          verifyBy: "检查简介、评论、内容中是否有产品/社群/咨询入口",
          correctionSignal: "无任何 CTA 或转化入口",
          misjudgeCost: "高估商业价值，投入资源后发现无法变现",
        },
        {
          claim: "内容强则变现强",
          couldBeWrongIf: "内容受众和付费受众不是同一群人",
          verifyBy: "对比内容主题与潜在产品的匹配度",
          correctionSignal: "内容吸引的是免费学习者，非付费客户",
          misjudgeCost: "错估变现潜力",
        },
      ],
      actionSuggestion: "增加低门槛转化动作（资料领取、社群、咨询入口），验证付费意愿。",
    },
    {
      questionNo: 5,
      layerName: "战略反证层",
      coreQuestion: "下一步押什么？这个判断可能错在哪里？",
      oneLineConclusion: buildStrategicSummary(analysis),
      confidence: "中",
      evidenceSource: [
        "六维评分",
        "分析建议",
        "前四层诊断结论",
      ],
      bodySections: [
        "本层综合前四层诊断结果，给出战略下注方向。",
        "所有下注建议都需要 30 天小实验验证，不直接全量转型。",
        "战略判断置信度标为中，因为缺少私域和成交数据。",
      ],
      keyCharts: ["六维评分雷达图", "战略下注卡"],
      falsificationTable: [
        {
          claim: "当前内容方向值得继续押注",
          couldBeWrongIf: "用户需求变化、平台推荐变化、竞品跟进",
          verifyBy: "30 天新增内容表现对比历史均值",
          correctionSignal: "新内容互动持续低于历史均值",
          misjudgeCost: "浪费 30-90 天内容产能",
        },
        {
          claim: "可以按建议方向转型",
          couldBeWrongIf: "新方向和现有粉丝画像不匹配",
          verifyBy: "小批量测试新方向，观察粉丝反馈",
          correctionSignal: "新方向带来低质量粉丝或负反馈",
          misjudgeCost: "稀释现有心智，两头不到岸",
        },
      ],
      actionSuggestion: "用 30 天小实验验证下注方向，设置明确止损信号。",
    },
  ]
}

function buildStrategicSummary(analysis: ApiCompetitorAnalysis): string {
  const scores = analysis.analysisResult?.scores
  if (!scores) return "数据不足，无法给出战略判断。"

  const parts: string[] = []
  if (scores.content_power >= 70) parts.push("内容力是核心资产，应继续深耕")
  if (scores.engagement_power >= 70) parts.push("互动率高，可押信任内容和社群承接")
  if (scores.monetization_power < 50) parts.push("变现力不足，需先补转化链路")
  if (scores.growth_power < 50) parts.push("增长力偏弱，需优化发布策略或内容形式")

  return parts.length > 0 ? parts.join("；") + "。" : "各维度表现均衡，需进一步验证核心优势方向。"
}

// ─── Content Strategy Builder ────────────────────────────

function buildContentStrategy(analysis: ApiCompetitorAnalysis): ContentStrategyData {
  const cs = analysis.analysisResult?.sections?.content_strategy
  const topicDistribution = cs?.topic_distribution ?? []
  const hookPatterns = cs?.hook_patterns ?? []

  const topTopics = topicDistribution.slice(0, 2).map(t => `${t.topic} ${t.percentage}%`)
  const summary = topicDistribution.length > 0
    ? `这个账号不是靠单条爆款，而是靠${topTopics.join("、")}等方向形成稳定内容心智。`
    : "内容策略数据不足。"

  return {
    topicDistribution,
    contentFormats: cs?.content_formats ?? [],
    hookPatterns,
    postingFrequency: cs?.posting_frequency ?? "",
    bestPostingTimes: cs?.best_posting_times ?? "",
    viralFormula: cs?.viral_formula ?? "",
    summary,
  }
}

// ─── Evidence Builder ────────────────────────────────────

function buildEvidence(analysis: ApiCompetitorAnalysis): EvidenceData {
  const stats = analysis.analysisResult?.stats
  const engagement = analysis.metricsData?.engagement
  const engAnalysis = analysis.analysisResult?.sections?.engagement_analysis

  return {
    topVideos: stats?.top_videos ?? [],
    postingHeatmap: stats?.posting_heatmap ?? {},
    avgEngagementRate: engagement?.weighted_engagement_rate ?? engAnalysis?.avg_engagement_rate ?? 0,
    avgLikes: engagement?.avg_likes ?? engAnalysis?.avg_likes ?? 0,
    avgComments: engagement?.avg_comments ?? engAnalysis?.avg_comments ?? 0,
    avgShares: engagement?.avg_shares ?? engAnalysis?.avg_shares ?? 0,
  }
}

// ─── Strategic Bets Builder ──────────────────────────────

function buildStrategicBets(analysis: ApiCompetitorAnalysis): StrategicBet[] {
  const scores = analysis.analysisResult?.scores
  const cs = analysis.analysisResult?.sections?.content_strategy
  const bets: StrategicBet[] = []

  if (scores && scores.content_power >= 60) {
    bets.push({
      type: "主推",
      title: "继续押高价值教程/分析 + 商业化场景",
      reason: `内容力评分 ${Math.round(scores.content_power)}，${cs?.viral_formula ? `爆款公式已验证：${cs.viral_formula}` : "内容质量有数据支撑"}`,
      successCondition: "30 天内高价值教程类内容继续贡献最高互动和收藏",
      risk: "内容生产成本高，容易疲劳",
      resourceRequired: "稳定选题库、案例素材、教程结构模板",
      stopLossSignal: "连续 4 条深度教程互动低于账号均值",
      action30d: "发布 6-8 条深度教程/分析，统一钩子和 CTA",
      action90d: "沉淀系列栏目，接产品/社群/咨询入口",
    })
  } else if (scores && scores.engagement_power >= 60) {
    bets.push({
      type: "主推",
      title: "押高互动内容 + 社群承接",
      reason: `互动力评分 ${Math.round(scores.engagement_power)}，粉丝活跃度高`,
      successCondition: "30 天内社群或私域线索增长",
      risk: "互动不等于付费意愿",
      resourceRequired: "社群运营工具、低门槛转化钩子",
      stopLossSignal: "互动高但无任何私域转化",
      action30d: "在内容中加入社群/资料领取 CTA，观察转化",
      action90d: "建立社群运营 SOP，跑通转化路径",
    })
  } else {
    bets.push({
      type: "主推",
      title: "先验证内容方向，再决定下注",
      reason: "各维度评分未出现明显优势，需先测试",
      successCondition: "30 天内找到 1-2 个互动明显高于均值的内容方向",
      risk: "测试周期可能较长",
      resourceRequired: "3-5 个不同方向的内容测试",
      stopLossSignal: "所有方向互动都低于预期",
      action30d: "每个方向各发 2-3 条，记录数据",
      action90d: "基于数据选择最强方向集中发力",
    })
  }

  const monetizationTopics = cs?.topic_distribution?.find(t =>
    t.topic.includes("商业") || t.topic.includes("变现") || t.topic.includes("赚钱"),
  )
  if (monetizationTopics && monetizationTopics.percentage >= 20) {
    bets.push({
      type: "备选",
      title: "押商业变现案例拆解",
      reason: `${monetizationTopics.topic}占比 ${monetizationTopics.percentage}%，适合承接高价值用户`,
      successCondition: "评论区出现咨询、收藏、转发、私信增长",
      risk: "容易变成泛泛讲趋势，缺乏实操",
      resourceRequired: "真实案例、成本收益数据、落地流程",
      stopLossSignal: "播放高但咨询弱",
      action30d: "做 3 个案例拆解",
      action90d: "形成案例库和客户转化路径",
    })
  } else {
    bets.push({
      type: "备选",
      title: "押个人经验/故事类内容",
      reason: "人设内容有助于建立信任，降低商业化阻力",
      successCondition: "故事类内容收藏率和评论深度提升",
      risk: "和现有内容风格可能不搭",
      resourceRequired: "真实经历素材、叙事结构",
      stopLossSignal: "故事类内容互动明显低于干货类",
      action30d: "尝试 2-3 条个人经验分享",
      action90d: "如果有效，形成固定栏目",
    })
  }

  bets.push({
    type: "不建议",
    title: "不建议押泛娱乐热点",
    reason: "和账号资产心智弱相关，短期播放不等于长期资产",
    successCondition: "-",
    risk: "稀释专业心智，吸引低质量粉丝",
    resourceRequired: "-",
    stopLossSignal: "娱乐热点带来粉丝但不带来咨询和复购",
    action30d: "-",
    action90d: "-",
  })

  if (scores && scores.monetization_power < 50) {
    bets.push({
      type: "不建议",
      title: "不建议直接重商业化",
      reason: `变现力评分仅 ${Math.round(scores.monetization_power)}，转化链路未验证`,
      successCondition: "-",
      risk: "粉丝未建立足够信任时强推产品，导致取关",
      resourceRequired: "-",
      stopLossSignal: "商业化内容播放明显低于非商业内容",
      action30d: "-",
      action90d: "-",
    })
  }

  return bets
}

// ─── Falsification Summary Builder ───────────────────────

function buildFalsificationSummary(questions: DiagnosisQuestion[]): FalsificationRow[] {
  return questions.flatMap(q => q.falsificationTable)
}

// ─── Main Builder ────────────────────────────────────────

export function buildCompetitorDiagnosisViewModel(
  analysis: ApiCompetitorAnalysis,
): CompetitorDiagnosisViewModel {
  const r = analysis.analysisResult
  const scores = r?.scores
  const videoCount = analysis.videoCount
  const hasMetrics = !!analysis.metricsData
  const hasContentStrategy = !!(r?.sections?.content_strategy?.topic_distribution?.length)
  const hasTopVideos = !!r?.stats?.top_videos?.length

  const overallScore = analysis.overallScore ?? scores?.overall ?? 0
  const confidence = calcConfidence(videoCount, hasMetrics, hasContentStrategy, hasTopVideos)

  const diagnosisQuestions = buildDiagnosisQuestions(analysis)

  return {
    accountName: analysis.accountName ?? analysis.targetUrl,
    accountAvatar: analysis.accountAvatar,
    followerCount: analysis.followerCount,
    videoCount: analysis.videoCount,
    accountTotalLikes: analysis.accountTotalLikes,
    completedAt: analysis.completedAt ?? analysis.createdAt,
    overallScore,
    assetGrade: assetGrade(overallScore),
    oneLineVerdict: buildOneLineVerdict(analysis),
    confidence,
    verdict: buildVerdict(analysis),
    diagnosisQuestions,
    contentStrategy: buildContentStrategy(analysis),
    evidence: buildEvidence(analysis),
    bets: buildStrategicBets(analysis),
    falsificationSummary: buildFalsificationSummary(diagnosisQuestions),
    rawAnalysis: analysis,
  }
}