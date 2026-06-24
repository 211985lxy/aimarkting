import { prisma } from "@/lib/prisma"
import { LLMClient } from "@/lib/llm/client"
import { getAgentLLM } from "@/lib/llm/agent-router"
import type { ChatMessage } from "@/lib/llm/types"
import { buildIpCopywritingMethodologyBlock } from "@/lib/ip-copywriting-methodology"
import { buildBusinessDiagnosisMethodologyBlock } from "@/lib/business-diagnosis-methodology"
import { retrieveRelevantKnowledge, ensureKnowledgeEmbedding } from "@/lib/llm/embeddings"
import { buildAimKnowledgeContext, fireKnowledgeEmbedding } from "@/lib/aim-knowledge-context"
import { compressAimMessages } from "@/lib/aim-context-compressor"
import {
  ContentFormat,
  AimTaskType,
  buildViralStructureBlock,
  parseMultiFormatResponse,
} from "./aim-generator"

// ─── 类型定义 ──────────────────────────────────────────────

export type AimAgentId =
  | "content_producer"
  | "deep_copywriter"
  | "business_system_diagnosis"
  | "business_diagnosis"
  | "content_review"

export interface AimChatParams {
  userId: string
  projectId?: string
  messages: any[]
  knowledgeBlock: string
  methodologyBlock: string
  businessDiagnosisBlock: string
}

export interface AimChatResponse {
  content: string
}

export interface AimGenerateContext {
  userId: string
  projectId: string
  rawInput: string
  targetFormats: ContentFormat[]
  taskType?: AimTaskType
  topicTitle?: string
  topicRationale?: string
  hotTopic?: string
  polishInstruction?: string
  
  // 共享数据上下文
  knowledgeBlock: string
  methodologyBlock: string
  businessDiagnosisBlock: string
  viralStructureBlock: string
  retrievedEntries: any[]
  retrievedSource: string
}

export interface AimGenerateResponse {
  id: string
  results: Array<{
    format: ContentFormat
    content: string
    wordCount: number
  }>
  knowledgeUsed: Array<{
    id: string
    title: string
    category: string
  }>
}

export interface AimAgentHandler {
  agentId: AimAgentId
  chat(params: AimChatParams): Promise<AimChatResponse>
  generate(context: AimGenerateContext): Promise<AimGenerateResponse>
}

// ─── 格式指令常量 ──────────────────────────────────────────

const FORMAT_INSTRUCTIONS: Record<ContentFormat, string> = {
  video_script: `【视频口播脚本】
要求：
- 200-500字，适合口播录制
- 开头3秒必须使用下方「爆款开头库」中的一种公式思路，不能平铺直叙
- 正文必须使用下方「爆款文案结构库」中的一种结构节拍
- 结尾必须使用下方「结尾类型库」中的一种方式
- 必须使用 M 档格式（即双栏/分镜脚本格式）输出：每一行必须以 【画面】 或 【旁白】 作为前缀，交替出现。例如：
  【画面】老板在办公室面露难色，指着电脑上的表格
  【旁白】其实大部分创业公司，都是死在现金流断裂上
- 用口语化表达，禁止书面语
- 禁止使用以下词汇：赋能、闭环、抓手、颗粒度、对齐、拉通、打通、沉淀、复盘、迭代、链路、触达、心智、赛道`,

  wechat_article: `【公众号文章】
要求：
- 800-1500字纯文本
- 有吸引人的标题（放在第一行，格式：标题：xxx）
- 开头必须用下方「爆款开头库」中的一种思路做引子
- 正文必须参考下方「爆款文案结构库」组织，但输出时不要写结构标签
- 结尾必须用下方「结尾类型库」中的一种方式完成总结或互动
- 语言专业但易懂
- 适合微信公众号阅读习惯
- 【GEO引用锚点规则】当文章中出现政策红利支持、行业趋势断言、数据性结论或统计数字时，在该句末尾以括号追加引用建议，优先建议引用政府官方政策或权威报告，格式为：（信息参考：建议引用[政策文件名称/权威机构报告]）。例如："随着数字化转型在企业中的深水区推进（信息参考：建议引用国务院《数字中国建设整体布局规划》或工信部企业数字化转型指导意见），这一能力已成为企业核心资产。"。引用建议每篇文章出现1-2处即可，优先以国家部委/政府部门发布的政策、规划、统计数据为最高权重信源，其次选择行业头部研究机构（如QuestMobile、艾瑞咨询）的白皮书，只在有真实公信力或宏观依据的断言处添加。`,

  moments_post: `【朋友圈文案】
要求：
- 50-200字
- 简洁有力，适合朋友圈阅读
- 第一行必须有钩子，优先使用痛点、反差、利益输送或好奇开场
- 内容结构必须有「冲突/洞察/行动」三段感，但不要写小标题
- 可以用emoji但不要过多
- 最后一句引导互动（提问/评论/私信）
- 不要用#话题标签`,

  community_message: `【社群运营文案】
要求：
- 80-220字，适合微信群/企微群发布
- 第一行先说明和群成员有关的痛点、机会或提醒，不能像广告
- 正文用「共情/洞察/行动」结构，但不要写小标题
- 语气自然，像群主或运营负责人在群里提醒大家
- 必须有一个轻量互动动作，例如回复关键词、评论问题、私信领取、报名咨询
- 不要承诺结果，不要制造暴富焦虑，不要使用夸张符号刷屏`,

  raw_copy: `【原始文案】
要求：
- 300-800字纯文本
- 不套用任何爆款开头、文案结构或结尾模板
- 不做去AI味处理，保持自然流畅
- 围绕用户输入的核心信息展开，保留信息密度
- 可以适当分段，但不要加小标题
- 适合作为后续精修、改编的基础初稿`,

  shooting_brief: `【拍摄交接单】
要求：
- 输出给拍摄、剪辑、运营执行，必须具体、清楚、可落地
- 必须包含以下字段，字段名不能省略：
视频标题：
核心观点：
目标客户：
视频目标：涨粉 / 建信任 / 引流 / 成交 / 客户教育 / 招商加盟（选择最适合的一项）
拍摄形式：口播 / 访谈 / 场景展示 / 混剪（选择最适合的一项）
建议时长：
脚本正文：
必拍镜头：
补充素材：
封面文案：
评论区引导：
私域承接话术：
事实风险提醒：
- 必拍镜头至少给 3 条，评论区引导和私域承接话术必须能直接复制使用
- 不承诺效果，不写保证涨粉、保证成交、月入多少等高风险表达`,

  koubo_script: `【口播文案】
要求：
- 200-500字纯口播文字，适合直接对着镜头念
- 禁止分镜格式，不要写【画面】【旁白】等任何前缀或镜头标注
- 开头3秒必须使用下方「爆款开头库」中的一种公式思路，制造停留
- 正文必须使用下方「爆款文案结构库」中的一种结构节拍推进
- 结尾必须使用下方「结尾类型库」中的一种方式收束
- 用口语化表达，短句为主，保留必要停顿和语气词，禁止书面语
- 一段话就是一个完整口播段落，可以直接录制
- 禁止使用以下词汇：赋能、闭环、抓手、颗粒度、对齐、拉通、打通、沉淀、复盘、迭代、链路、触达、心智、赛道`,

  xiaohongshu_post: `【小红书图文】
要求：
- 300-600字，适合小红书图文笔记
- 第一行必须是吸睛标题（可带emoji，15字以内，制造好奇/反差/利益/痛点）
- 正文用短段落+emoji分段，每段1-3句，节奏轻快
- 语气真实、像真人分享经验，第一人称视角
- 必须有1个核心干货或洞察，让用户觉得"有用想收藏"
- 结尾引导互动（点赞收藏/评论/关注）
- 最后用2-5个#话题标签收尾，贴合小红书搜索习惯
- 禁止硬广和明显营销腔，禁止保证效果`,
}

// ─── 1. 内容生产官 (ContentProducerHandler) ──────────────────

class ContentProducerHandler implements AimAgentHandler {
  agentId = "content_producer" as const

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    const systemPrompt = `你是一个身经百战的「太极营销创意总监」，正与企业老板（用户）面对面进行爆款营销文案创意碰撞与思路对齐。

你的使命：
根据用户已经给出的素材、对标文案、企业知识库和方法论，直接给出可执行的文案方向、初稿或改写建议。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

IP操盘方法论（写作与判断规则）：
${params.methodologyBlock}

你的对话原则：
1. 文案类智能体不追问客户，不让客户补充资料，不输出追问式开场。
2. 如果信息不足，基于已有上下文做合理假设，直接给出一个可用版本。
3. 可以说明"我会先按某个方向处理"，但后面必须跟成稿、结构方案或可复制文案。
4. 绝对不要说 AI 味的官腔、客套话（如"很高兴能与您碰撞"、"这是一个非常好的切入点"等）。
5. 先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
6. 如果用户确实需要先做定位或诊断，只给一句简短建议引导去定位策划官或商业诊断官，不在内容生产官里追问。

请直接根据上文与用户的历史对话，产出下一轮内容。`

    return executeChatLLM(this.agentId, systemPrompt, params.messages)
  }

  async generate(context: AimGenerateContext): Promise<AimGenerateResponse> {
    const agentPrompt = `你是一个企业营销内容专家。根据用户提供的信息，结合企业知识库，生成高质量的营销内容。`
    
    const formatBlocks = context.targetFormats
      .map((format) => FORMAT_INSTRUCTIONS[format])
      .join("\n\n---\n\n")

    const systemPrompt = buildProducerSystemPrompt(agentPrompt, formatBlocks, context)
    const userPrompt = buildUserPrompt(context, formatBlocks)

    const completion = await executeGenerateLLM(this.agentId, systemPrompt, userPrompt)
    const parsed = parseMultiFormatResponse(completion.content, context.targetFormats)

    const record = await saveAimGenerationRecord(context, completion, parsed)

    return {
      id: record.id,
      results: context.targetFormats.map((format) => ({
        format,
        content: parsed[format] || "",
        wordCount: (parsed[format] || "").length,
      })),
      knowledgeUsed: record.knowledgeUsed as any[],
    }
  }
}

// ─── 2. 深度文案官 (DeepCopywriterHandler) ─────────────────────

class DeepCopywriterHandler implements AimAgentHandler {
  agentId = "deep_copywriter" as const

  /** 深度文案官在 generate 模式下只允许产出全文类格式 */
  private static readonly ALLOWED_GENERATE_FORMATS = new Set<ContentFormat>(["raw_copy", "wechat_article"])

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    const systemPrompt = `你是一个深度文案官，负责把想法、视频原文、老板口述或对标文案，打磨成一篇高质量、可拆分复用的深度母稿。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

IP操盘方法论（写作与判断规则）：
${params.methodologyBlock}

你的对话原则：
1. 先判断选题是否有情绪波动、用户痛点、表达欲和可融合热点。
2. 人设性、观点型、老板口述和对标文案改造，默认先问后写。
3. 先一次性给出 3-5 个半开放选择题挖出用户真实观点；每题给 2-4 个选项，选项必须紧跟问题并按以下格式独立成行，方便前端渲染成逐题点击流程：
A. 选项内容
B. 选项内容
C. 选项内容
4. 不要只抛开放式问题；如果需要用户补充，把"也可以补一句真实想法"放在选项之后。
5. 用户回答后，再输出观点确认、大纲、第一句话/前3秒钩子和深度母稿。
6. 如果用户一开始已经提供足够强的观点和经历，可以少问，但仍至少做一次观点确认。
7. 热点只能基于用户提供的热点、已有上下文或明确行业趋势自然融合，禁止硬蹭或编造。
8. 成稿前先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
9. 不暴露外部参考来源细节。

请直接根据上文与用户的历史对话，产出下一轮内容。`

    return executeChatLLM(this.agentId, systemPrompt, params.messages)
  }

  async generate(context: AimGenerateContext): Promise<AimGenerateResponse> {
    // ── 输出边界：强制只允许全文类格式 ──
    const allowed = context.targetFormats.filter((f) =>
      DeepCopywriterHandler.ALLOWED_GENERATE_FORMATS.has(f)
    )
    // 如果所有请求格式都不在允许范围内，默认产出 raw_copy
    const safeTargets = allowed.length > 0 ? allowed : ["raw_copy" as ContentFormat]

    const agentPrompt = `你是一个深度文案官，专门把想法、视频原文、老板口述或对标文案打磨成高质量深度长文正文。

【核心输出规则 — 严格遵循】
- 你只能输出一篇完整深度长文正文，禁止输出以下任何内容：
  ✗ 观点确认卡
  ✗ 热点判断
  ✗ 内容大纲
  ✗ 开头钩子或前 3 秒设计
  ✗ 备选版本
  ✗ 后续拆分方向（如"可以拆成朋友圈/短视频"）
  ✗ 朋友圈、短视频、公众号、私域话术等平台分发内容
- 正文可以口播化，但必须是一篇连续长文，不要拆成多个交付模块。
- 热点只能基于用户提供的热点、已有上下文或明确行业趋势自然融合，禁止硬蹭或编造。
- 先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
- 不暴露外部参考来源细节。`

    const systemPrompt = `${agentPrompt}

${context.knowledgeBlock}
${context.methodologyBlock}

内部工作流程：
1. 围绕选题主张或输入素材，展开成文。
2. 保持真实口语感、情绪共鸣与深刻洞察，杜绝公文宣传腔和万金油排比句。
3. 不管用户要求何种格式，一律只输出一篇完整深度长文正文，不加任何附加结构标记。

请严格按照格式输出。不要添加任何附加的大纲、钩子栏目或标题标记。`

    const workflowContext = buildWorkflowContext(context)
    const userPrompt = `用户输入的原始内容：
"${context.rawInput}"

${workflowContext ? `工作流上下文：
${workflowContext}

` : ""}

请生成这篇深度长文正文。直接输出正文，不要包含任何解释性文字。`

    const completion = await executeGenerateLLM(this.agentId, systemPrompt, userPrompt)

    const rawText = completion.content.trim()

    const parsed: Record<ContentFormat, string | undefined> = {
      video_script: undefined,
      wechat_article: undefined,
      moments_post: undefined,
      community_message: undefined,
      shooting_brief: undefined,
      koubo_script: undefined,
      xiaohongshu_post: undefined,
      raw_copy: safeTargets.includes("raw_copy") ? rawText : undefined,
    }

    if (safeTargets.includes("wechat_article")) {
      parsed.wechat_article = rawText
    }

    const record = await saveAimGenerationRecord(context, completion, parsed)

    return {
      id: record.id,
      results: safeTargets.map((format) => ({
        format,
        content: rawText,
        wordCount: rawText.length,
      })),
      knowledgeUsed: record.knowledgeUsed as any[],
    }
  }
}

// ─── 3. 商业诊断官 (BusinessSystemDiagnosisHandler) ───────────

class BusinessSystemDiagnosisHandler implements AimAgentHandler {
  agentId = "business_system_diagnosis" as const

  /** 商业诊断官仅产出诊断报告 */
  private static readonly ALLOWED_GENERATE_FORMATS = new Set<ContentFormat>(["raw_copy"])

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    const systemPrompt = `你是一个企业商业诊断官，正在帮助用户做一次生意系统体检。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

商业诊断方法论（内部判断规则）：
${params.businessDiagnosisBlock}

你的对话原则：
1. 先校准事实，再做判断。信息不足时，每次只追问一个最关键问题，并给出 2-4 个可选答案让用户选择。
2. 重点围绕业务类型、现状数据、真实目标、约束条件、验收标准追问。
3. 统一呈现为生意系统体检，不解释内部方法来源。
4. 如果信息已经足够，提醒用户可以点击【一键生成】生成完整诊断报告。
5. 不要让用户做开放式填空题；如果必须开放补充，把它放在选项之后，作为"也可以补充具体情况"。

请直接根据上文与用户的历史对话，产出你下一轮的建议或追问。`

    return executeChatLLM(this.agentId, systemPrompt, params.messages)
  }

  async generate(context: AimGenerateContext): Promise<AimGenerateResponse> {
    // ── 输出边界：只产出 raw_copy 诊断报告 ──
    const safeTargets = context.targetFormats.filter((f) =>
      BusinessSystemDiagnosisHandler.ALLOWED_GENERATE_FORMATS.has(f)
    )
    const effectiveFormats = safeTargets.length > 0 ? safeTargets : ["raw_copy" as ContentFormat]

    const systemPrompt = `你是一个企业商业诊断官，负责根据与用户的沟通事实，结合企业知识库，生成专业的生意系统体检报告。

商业诊断方法论（体检评判准则）：
${context.businessDiagnosisBlock}

企业已有核心知识库（参考背景）：
${context.knowledgeBlock}

体检报告输出结构要求：
1. 生意现状概要与定位诊断
2. 核心系统瓶颈与成因深度剖析（如流量结构失调、客单价偏低、成交转化漏斗断层等）
3. 关键业务痛点（结合企业已有痛点背景）
4. 落地改造优化路径及具体改造动作（至少给出 3 个切实可行的战术动作）

【禁止输出】短视频脚本、朋友圈文案、社群文案、拍摄交接单、公众号文章等任何营销分发内容。
请严格以专业、敏锐、逻辑严密的视角完成报告，不要说任何AI官腔。直接输出报告，不输出无关的大纲、钩子或朋友圈文案分发内容。`

    const workflowContext = buildWorkflowContext(context)
    const userPrompt = `用户输入的原始信息与对话记录：
"${context.rawInput}"

${workflowContext ? `工作流上下文：
${workflowContext}

` : ""}

请生成这份详细的"生意系统体检报告"。`

    const completion = await executeGenerateLLM(this.agentId, systemPrompt, userPrompt)
    const rawText = completion.content.trim()

    const parsed: Record<ContentFormat, string | undefined> = {
      video_script: undefined,
      wechat_article: undefined,
      moments_post: undefined,
      community_message: undefined,
      shooting_brief: undefined,
      koubo_script: undefined,
      xiaohongshu_post: undefined,
      raw_copy: rawText,
    }

    const record = await saveAimGenerationRecord(context, completion, parsed)

    return {
      id: record.id,
      results: effectiveFormats.map((format) => ({
        format,
        content: rawText,
        wordCount: rawText.length,
      })),
      knowledgeUsed: record.knowledgeUsed as any[],
    }
  }
}

// ─── 4. 定位策划官 (BusinessDiagnosisHandler) ────────────────

class BusinessDiagnosisHandler implements AimAgentHandler {
  agentId = "business_diagnosis" as const

  /** 定位策划官仅产出定位方案 */
  private static readonly ALLOWED_GENERATE_FORMATS = new Set<ContentFormat>(["raw_copy"])

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    const systemPrompt = `你是一个定位策划官，负责帮助用户明确 IP 定位、人设定位、内容定位和初始成交路径。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

你的对话原则：
1. 只处理 IP 本身：这个人如何站出来、被谁信任、讲什么内容、承接什么产品。
2. 信息不足时，每次只追问一个最关键问题，并给出 2-4 个可选答案让用户选择。
3. 不要让用户做开放式填空题；选项必须具体，例如"专家型 / 老板实战型 / 陪伴型 / 行业观察型"。
4. 如果信息已经足够，提醒用户可以点击【一键生成】生成定位方案。

请直接根据上文与用户的历史对话，产出你下一轮的建议或追问。`

    return executeChatLLM(this.agentId, systemPrompt, params.messages)
  }

  async generate(context: AimGenerateContext): Promise<AimGenerateResponse> {
    // ── 输出边界：只产出 raw_copy 定位方案 ──
    const safeTargets = context.targetFormats.filter((f) =>
      BusinessDiagnosisHandler.ALLOWED_GENERATE_FORMATS.has(f)
    )
    const effectiveFormats = safeTargets.length > 0 ? safeTargets : ["raw_copy" as ContentFormat]

    const systemPrompt = `你是一个定位策划官，负责为企业老板明确 IP 营销的全局定位与成交路径方案。

企业已有核心知识库（参考背景）：
${context.knowledgeBlock}

策划方案输出结构要求：
1. IP定位主张：一句话的差异化定位口号（Slogan）及核心目标受众画像。
2. 人设定位与人设立体塑造（人设标签、价值锚点、信任线索）。
3. 核心内容体系规划：梳理 3 大核心内容方向/选题专栏，并设计爆款选题示范。
4. 初始成交路径设计：用户从刷到短视频、进粉丝群，到最终加私域成交的完整路线指引。

【禁止输出】短视频脚本、朋友圈文案、社群文案、拍摄交接单、公众号文章等任何营销分发内容。
请直接交付一份落地方案，语气干练、坚定、去AI味，不用加任何多余的开头废话，直接输出正文。`

    const workflowContext = buildWorkflowContext(context)
    const userPrompt = `用户输入的原始信息与背景：
"${context.rawInput}"

${workflowContext ? `工作流上下文：
${workflowContext}

` : ""}

请生成这份详细的"IP营销策划定位方案"。`

    const completion = await executeGenerateLLM(this.agentId, systemPrompt, userPrompt)
    const rawText = completion.content.trim()

    const parsed: Record<ContentFormat, string | undefined> = {
      video_script: undefined,
      wechat_article: undefined,
      moments_post: undefined,
      community_message: undefined,
      shooting_brief: undefined,
      koubo_script: undefined,
      xiaohongshu_post: undefined,
      raw_copy: rawText,
    }

    const record = await saveAimGenerationRecord(context, completion, parsed)

    return {
      id: record.id,
      results: effectiveFormats.map((format) => ({
        format,
        content: rawText,
        wordCount: rawText.length,
      })),
      knowledgeUsed: record.knowledgeUsed as any[],
    }
  }
}

// ─── 5. 数据复盘官 (ContentReviewHandler) ────────────────────

class ContentReviewHandler implements AimAgentHandler {
  agentId = "content_review" as const

  /** 数据复盘官仅产出复盘报告 */
  private static readonly ALLOWED_GENERATE_FORMATS = new Set<ContentFormat>(["raw_copy"])

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    const systemPrompt = `你是一个内容复盘官，负责根据已发布内容、播放互动数据、评论反馈和转化情况，判断内容表现，并给出下一轮优化和复用方向。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

你的对话原则：
1. 先判断内容表现：选题、开头、结构、表达、承接动作分别哪里有效或失效。
2. 不泛泛鼓励，不输出空话，必须给出明确判断和下一步动作。
3. 如果用户给了评论或私信，把它们提炼成新选题、复用角度或私域承接话术。
4. 如果信息不足，直接按已给信息做保守复盘，并说明还缺哪一类数据。
5. 输出优先包含：表现判断、原因、下一轮优化、可复用资产、可延展新选题。

请直接根据上文与用户的历史对话，产出下一轮内容。`

    return executeChatLLM(this.agentId, systemPrompt, params.messages)
  }

  async generate(context: AimGenerateContext): Promise<AimGenerateResponse> {
    // ── 输出边界：只产出 raw_copy 复盘报告 ──
    const safeTargets = context.targetFormats.filter((f) =>
      ContentReviewHandler.ALLOWED_GENERATE_FORMATS.has(f)
    )
    const effectiveFormats = safeTargets.length > 0 ? safeTargets : ["raw_copy" as ContentFormat]

    const systemPrompt = `你是一个内容数据复盘官，负责结合已发布视频/文章的实际播放表现、互动指标或用户反馈，进行深度剖析，输出调优建议。

企业已有核心知识库（参考背景）：
${context.knowledgeBlock}

复盘报告输出结构要求：
1. 表现多维度研判：诊断此前的选题、开头钩子、内容结构是否达到预期，哪些起效、哪些失效。
2. 核心失效原因深挖（例如：痛点不痛、AI味过浓、表达拖沓、未针对精准画像、行动引导脱节等）。
3. 爆款选题/内容资产的二次复用与延展建议。
4. 下一轮迭代调优的具体行动单：包括怎么改开头、保留什么表达，如何调整私域转化动作。

【禁止输出】短视频脚本、朋友圈文案、社群文案、拍摄交接单、公众号文章等任何新的营销分发内容。
请直接输出复盘建议，不写套话、黑话和前言，直接输出复盘报告。`

    const workflowContext = buildWorkflowContext(context)
    const userPrompt = `用户输入的内容表现与相关数据反馈：
"${context.rawInput}"

${workflowContext ? `工作流上下文：
${workflowContext}

` : ""}

请生成这份详细的"内容数据复盘报告"。`

    const completion = await executeGenerateLLM(this.agentId, systemPrompt, userPrompt)
    const rawText = completion.content.trim()

    const parsed: Record<ContentFormat, string | undefined> = {
      video_script: undefined,
      wechat_article: undefined,
      moments_post: undefined,
      community_message: undefined,
      shooting_brief: undefined,
      koubo_script: undefined,
      xiaohongshu_post: undefined,
      raw_copy: rawText,
    }

    const record = await saveAimGenerationRecord(context, completion, parsed)

    return {
      id: record.id,
      results: effectiveFormats.map((format) => ({
        format,
        content: rawText,
        wordCount: rawText.length,
      })),
      knowledgeUsed: record.knowledgeUsed as any[],
    }
  }
}

// ─── 调度与分流器 ───────────────────────────────────────────

const HANDLERS: Record<AimAgentId, AimAgentHandler> = {
  content_producer: new ContentProducerHandler(),
  deep_copywriter: new DeepCopywriterHandler(),
  business_system_diagnosis: new BusinessSystemDiagnosisHandler(),
  business_diagnosis: new BusinessDiagnosisHandler(),
  content_review: new ContentReviewHandler(),
}

const VALID_AGENT_IDS = new Set<string>([
  "content_producer",
  "deep_copywriter",
  "business_system_diagnosis",
  "business_diagnosis",
  "content_review",
])

/** 前端/外部 API 使用的别名 → 内部 handler ID 映射 */
const AGENT_ID_ALIASES: Record<string, AimAgentId> = {
  ip_video: "content_producer",
}

export function getAgentHandler(agentId: string): AimAgentHandler {
  // 1. 直接命中
  if (VALID_AGENT_IDS.has(agentId)) {
    return HANDLERS[agentId as AimAgentId]
  }
  // 2. 尝试别名映射
  const aliased = AGENT_ID_ALIASES[agentId]
  if (aliased && VALID_AGENT_IDS.has(aliased)) {
    return HANDLERS[aliased]
  }
  // 3. 回退到默认 handler
  return HANDLERS.content_producer
}

/**
 * 统一 chat 处理入口
 */
export async function buildAimChatResponse(agentId: string, params: Omit<AimChatParams, "methodologyBlock" | "businessDiagnosisBlock">): Promise<AimChatResponse> {
  const handler = getAgentHandler(agentId)

  // 上下文压缩（对长对话保留最近轮次，早轮压缩成摘要）
  const compressed = compressAimMessages(agentId, params.messages)
  const enrichedKnowledgeBlock = compressed.didCompress
    ? `【对话摘要】\n${compressed.summary}\n\n${params.knowledgeBlock}`
    : params.knowledgeBlock

  const [methodologyBlock, businessDiagnosisBlock] = await Promise.all([
    buildIpCopywritingMethodologyBlock(),
    agentId === "business_system_diagnosis" ? buildBusinessDiagnosisMethodologyBlock() : Promise.resolve(""),
  ])

  return handler.chat({
    ...params,
    knowledgeBlock: enrichedKnowledgeBlock,
    methodologyBlock,
    businessDiagnosisBlock,
  })
}

/**
 * 统一 generate 处理入口
 */
export async function buildAimGeneration(agentId: string, params: Omit<AimGenerateContext, "knowledgeBlock" | "methodologyBlock" | "businessDiagnosisBlock" | "viralStructureBlock" | "retrievedEntries" | "retrievedSource">): Promise<AimGenerateResponse> {
  const handler = getAgentHandler(agentId)

  // 1. 项目校验
  if (params.projectId) {
    const project = await prisma.clientProject.findFirst({
      where: {
        id: params.projectId,
        userId: params.userId,
        status: "active",
      },
      select: { id: true },
    })
    if (!project) {
      throw new Error("客户项目不存在或已归档")
    }
  }

  // 2. 并行读取通用背景资产（统一知识上下文）
  const [knowledgeCtx, viralStructureBlock, methodologyBlock, businessDiagnosisBlock] = await Promise.all([
    params.projectId
      ? buildAimKnowledgeContext({
          userId: params.userId,
          projectId: params.projectId,
          agentId,
          query: params.rawInput,
          topicTitle: params.topicTitle,
          topicRationale: params.topicRationale,
        })
      : Promise.resolve({
          knowledgeBlock: "",
          entries: [],
          source: "raw" as const,
        }),
    buildViralStructureBlock(),
    buildIpCopywritingMethodologyBlock(),
    agentId === "business_system_diagnosis" ? buildBusinessDiagnosisMethodologyBlock() : Promise.resolve(""),
  ])

  // 3. 调用具体的智能体 Handler
  //    加入压缩摘要（如有必要，将用户原始输入视为消息列表）
  const generateMessages = [{ role: "user" as const, content: params.rawInput }]
  const compressed = compressAimMessages(agentId, generateMessages)
  const knowledgeWithContext = compressed.didCompress
    ? `【对话摘要】\n${compressed.summary}\n\n${knowledgeCtx.knowledgeBlock}`
    : knowledgeCtx.knowledgeBlock

  const response = await handler.generate({
    ...params,
    knowledgeBlock: knowledgeWithContext,
    methodologyBlock,
    businessDiagnosisBlock,
    viralStructureBlock,
    retrievedEntries: knowledgeCtx.entries,
    retrievedSource: knowledgeCtx.source,
  })

  // 4. 后续处理 (Fire-and-forget 向量写入)
  fireKnowledgeEmbedding(knowledgeCtx.entries, knowledgeCtx.source)

  return response
}

// ─── 共享辅助函数 ───────────────────────────────────────────

async function executeChatLLM(agentId: string, systemPrompt: string, messages: any[]): Promise<AimChatResponse> {
  const formattedMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content || "").trim(),
    })),
  ]

  const llm = getAgentLLM(agentId)
  const completion = await llm.complete({
    messages: formattedMessages,
    temperature: 0.7,
  })

  return {
    content: completion.content,
  }
}

async function executeGenerateLLM(agentId: string, systemPrompt: string, userPrompt: string) {
  const llm = getAgentLLM(agentId)
  return llm.complete({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    maxTokens: 4000,
  })
}

function buildWorkflowContext(context: AimGenerateContext): string {
  return [
    context.topicTitle
      ? `选定爆款选题：${context.topicTitle}${context.topicRationale ? `\n选题依据：${context.topicRationale}` : ""}`
      : null,
    context.hotTopic
      ? `需要结合的当前热点：${context.hotTopic}\n要求：只做自然融合，必须找到热点与客户需求、产品卖点或老板经验之间的真实关联，禁止硬蹭热点。`
      : null,
    context.polishInstruction
      ? `文案审核与优化要求：${context.polishInstruction}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")
}

function buildProducerSystemPrompt(agentPrompt: string, formatBlocks: string, context: AimGenerateContext): string {
  return `${agentPrompt}

${context.knowledgeBlock}
${context.methodologyBlock}
${context.businessDiagnosisBlock}
${context.viralStructureBlock}

内部工作流程：
1. 先判断输入内容类型：公众号长文、老板口述、原始文案、客户问题、产品卖点、对标文案或热点选题。
2. 如果用户提供对标文案，只学习它的开头方式、结构节奏、表达密度和转化设计，不照抄具体表达。
3. 如果用户提供公众号长文，优先提炼其中最适合短视频传播的一个核心观点，不要把整篇文章压缩成流水账。
4. 开头必须单独优化：用冲突、反差、痛点、利益或好奇心打开，避免平铺直叙。
5. 正文必须单独优化结构：按问题、判断、案例、行动或反差递进组织，让用户能听懂、能拍摄、能转化。
6. 必须结合企业知识库中的产品卖点、客户痛点、老板经验和项目案例，让内容适合当下企业，而不是生成通用文案。
7. 如果上下文包含垂类行业热点，只能自然融合和业务相关的部分，禁止硬蹭热点。

创作规则：
- 先判断用户输入最适合哪一种开头、文案结构和结尾类型，再开始写。
- 必须把专业结构融进最终文案里，但不要输出「使用了某某结构」这类解释。
- 开头要具体、有信息量、有冲突或利益点，禁止「今天给大家分享」「很多人不知道」这类空泛起手。
- 正文每一段都要推进信息，不要堆形容词，不要写营销黑话。
- 先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
- 保留必要的口语、停顿、重复和语气词；不要为了显得高级主动加金句、宏大比喻或整齐三段式。
- 文案生成必须直接交付成稿，不要反问用户、不要让用户补充资料、不要输出开放式问题。
- 如果信息不足，基于企业知识库、用户输入和现有上下文做合理假设，并在文案里自然处理。

请严格按照下方每种格式的要求，生成对应的内容。每种格式用 ===FORMAT:格式名=== 作为分隔标记。`
}

function buildUserPrompt(context: AimGenerateContext, formatBlocks: string): string {
  const workflowContext = buildWorkflowContext(context)
  return `用户输入的原始内容：
"${context.rawInput}"

${workflowContext ? `工作流上下文：\n${workflowContext}\n\n` : ""}

请根据以上内容，结合企业知识库中的相关信息，生成以下格式的营销内容：

${formatBlocks}

输出格式要求：
${context.targetFormats.map((format) => `===FORMAT:${format}===\n（在这里输出${format}的内容）`).join("\n\n")}`
}

async function saveAimGenerationRecord(
  context: AimGenerateContext,
  completion: any,
  parsed: Record<ContentFormat, string | undefined>
) {
  const knowledgeUsed = context.retrievedEntries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    category: entry.category,
  }))

  return prisma.aimGeneration.create({
    data: {
      userId: context.userId,
      projectId: context.projectId || null,
      rawInput: context.rawInput,
      inputSource: "text",
      videoScript: parsed.video_script || null,
      wechatArticle: parsed.wechat_article || null,
      momentsPost: parsed.moments_post || null,
      communityMessage: parsed.community_message || null,
      shootingBrief: parsed.shooting_brief || null,
      rawCopy: parsed.raw_copy || null,
      formatsRequested: context.targetFormats,
      knowledgeUsed,
      topicTitle: context.topicTitle || null,
      hotTopic: context.hotTopic || null,
      polishInstruction: context.polishInstruction || null,
      model: completion.model,
      totalTokens: completion.usage?.totalTokens || null,
      status: "completed",
    },
  })
}
