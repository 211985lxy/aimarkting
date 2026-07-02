import { prisma } from "@/lib/prisma"
import { LLMClient } from "@/lib/llm/client"
import { getAgentLLM } from "@/lib/llm/agent-router"
import type { ChatMessage } from "@/lib/llm/types"
import { buildIpCopywritingMethodologyBlock } from "@/lib/ip-copywriting-methodology"
import { buildBusinessDiagnosisMethodologyBlock } from "@/lib/business-diagnosis-methodology"
import { buildAimKnowledgeContext, fireKnowledgeEmbedding } from "@/lib/aim-knowledge-context"
import {
  resolveKnowledgeStrategy,
  type ResolvedKnowledgeStrategy,
} from "@/lib/aim-knowledge-strategy"
import { compressAimMessages } from "@/lib/aim-context-compressor"
import { buildIpWikiBlock } from "@/lib/ip-wiki/context"
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
  | "persona"

export interface AimChatParams {
  userId: string
  projectId?: string
  messages: any[]
  knowledgeBlock: string
  methodologyBlock: string
  businessDiagnosisBlock: string
  /** IP 定位维基（已编译定位底盘），无 projectId 或无维基页时为空串 */
  ipWikiBlock: string
}

export interface AimChatResponse {
  content: string
}

export interface AimGenerateContext {
  userId: string
  agentId: string
  projectId?: string
  rawInput: string
  targetFormats: ContentFormat[]
  taskType?: AimTaskType
  topicTitle?: string
  topicRationale?: string
  topicType?: string
  hotTopic?: string
  polishInstruction?: string
  videoCopyExtractionId?: string

  // 共享数据上下文
  knowledgeBlock: string
  methodologyBlock: string
  businessDiagnosisBlock: string
  viralStructureBlock: string
  /** IP 定位维基（已编译定位底盘），无 projectId 或无维基页时为空串 */
  ipWikiBlock: string
  retrievedEntries: any[]
  retrievedSource: string
  /** 本次实际生效的知识调用策略（解析后回传，供 UI 反馈） */
  knowledgeStrategy: ResolvedKnowledgeStrategy
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
  /** 本次实际生效的知识调用策略（由 buildAimGeneration 解析后注入，供 UI 反馈） */
  knowledgeStrategy?: ResolvedKnowledgeStrategy
}

export interface AimAgentHandler {
  agentId: AimAgentId
  chat(params: AimChatParams): Promise<AimChatResponse>
  streamChat(params: AimChatParams): AsyncIterable<string>
  generate(context: AimGenerateContext): Promise<AimGenerateResponse>
}

// ─── 格式指令常量 ──────────────────────────────────────────

/**
 * 小红书图文视觉导演指令（xiaohongshu_post 专用）
 * 吸收 xhs-visual-director-skill 的产品结构（风格判断 / 统一视觉母版 / 8页结构 / 逐页提示词 / 自检），
 * 用 AIM 自家风格映射重写，不照搬外部 prompt。第一版只输出图文方案，不接真实图片生成。
 */
export function buildXhsVisualDirectorInstruction(): string {
  return `【小红书图文视觉方案】
你现在是小红书高级图文视觉导演，不是普通文案助手。把用户输入的选题 / 观点 / 草稿 / 产品 / 案例，转化为一套可执行的图文视觉方案：风格判断 + 统一视觉母版 + 8 页图文结构 + 逐页视觉提示词 + 发布文案 + 发布前自检。

## 画幅硬规则（每页都必须遵守）
- 锁定 1080x1440px, strict 3:4 vertical portrait canvas
- 每页提示词都要重复：strict 3:4 vertical portrait, not square, not landscape, no extra border, no crop
- 手机端阅读优先，字不能小，重点信息一眼读懂

## 视觉风格映射（按内容选主风格 + 辅助风格；封面可更冲击，内页更理性）
- AI / Agent / 工具 / 技术观点：深色科技杂志风（主）+ 黑白灰荧光绿冲击风（封面）/ 架构图系统拆解风（内页）
- 商业 / 企业服务 / 产业方案：高级商业提案风（主）+ 高级极简黑金风 + 数据报告趋势洞察风
- 个人 IP / 观点 / 人设：个人品牌宣言风（主）+ 高级白底杂志风 + 夜间独白风
- 方法论 / 教程 / 知识拆解：Notion 高级卡片风（主）+ 课程讲义风 + 架构图系统拆解风

## 统一视觉母版（生成 8 页前必须先定，是后续每页的硬约束）
- 固定画布 1080x1440px 3:4
- 安全边距：左右 72px、上下 80px，整套一致
- 中文文字安全区：标题与正文不得超出安全边距，重要文字避开顶部状态栏与底部页码区
- 网格：12 列、8px 基准间距、统一卡片圆角
- 色彩令牌：背景色 / 主文字色 / 辅助文字色 / 强调色（只 1 个强调色）
- 字体令牌：中文标题、中文正文、英文注释
- 页码角标：固定位置、大小、样式
- 母版锁定前缀：后续每一页提示词都必须以这一段开头，不要只在总说明里写一次

## 8 页图文结构（每页只承担一个传播任务，禁止 PPT 式堆字）
1. 封面：强钩子 + 强视觉（吸引点击）
2. 痛点页：指出反常识或正在付出的代价
3. 认知页：为什么这件事重要
4. 方法页：给一个清晰框架
5. 案例页：用具体例子证明
6. 操作页：可立刻执行的步骤
7. 总结页：收束核心观点
8. 引导页：收藏 / 评论 / 关注

## 逐页必须输出
- 页面标题、副标题、核心文案、本页传播任务
- 本页使用风格 + 为什么这一页适合
- 视觉构图、主视觉元素、辅助元素
- 色彩、字体层级
- 图像生成提示词：画幅锁定 + 沿用母版哪些元素 + 本页只变化什么
- 负面提示词：必须含 no square image, no landscape, no inconsistent margins, no different template, no random layout shift

## 发布文案
- 小红书标题 5-10 个（标注主推版本）
- 正文（可用 emoji 但不堆砌，短句分段）
- 标签 2-5 个（贴合小红书搜索习惯）
- 评论区引导 + 可置顶评论

## 发布前自检
- 封面是否有冲击力、标题是否够大、手机端能否读清
- 画幅 / 边距 / 字体 / 页码是否全套统一
- 是否有收藏价值、是否避免了 PPT 感和廉价 AI 模板感
- 是否只说"高级、科技、极简"等空泛词（必须给具体视觉做法）

## 输出格式（用清晰 Markdown 分区，用户可直接复制给图片生成工具或设计师）
# 风格判断报告
# 统一视觉母版
# 8 页图文结构
# 逐页视觉提示词（Page 01 ~ Page 08）
# 小红书发布文案
# 发布前自检

## 禁止
- 廉价蓝紫渐变、随机霓虹、文字变形、塑料质感、儿童卡通感
- 每页都中心构图、巨大页码喧宾夺主、辅助元素比核心信息更抢眼
- 只写"高级、科技、极简"而不给具体视觉做法`
}

const FORMAT_INSTRUCTIONS: Record<ContentFormat, string> = {
  video_script: `【视频口播脚本】
要求：
- 200-500字，适合口播录制
- 开头3秒必须使用下方「爆款开头库」中的一种公式思路，不能平铺直叙
- 正文必须使用下方「爆款文案结构库」中的一种结构节拍
- 结尾必须使用下方「结尾类型库」中的一种方式
- 只输出纯口播文案正文，不要写画面、镜头、动作、字幕、音效或分镜说明
- 禁止出现【画面】【旁白】【镜头】【字幕】等任何分镜标签
- 节奏打磨：每10-12秒约40个字必须出现一个小转折、新观点或情绪点；如果段落太平，就用反问、比喻或一句结论拉住注意力
- 文盲式修改：删掉不影响意思的废话和虚词，用简单词替换书面语；每句话必须读起来顺口，像真人在说话；初中生听不懂就重写
- 用口语化表达，禁止书面语
- 禁止使用以下词汇：赋能、闭环、抓手、颗粒度、对齐、拉通、打通、沉淀、复盘、迭代、链路、触达、心智、赛道`,

  wechat_article: `【公众号文章】
要求：
- 至少2000字纯文本，不够2000字视为不合格
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
- 脚本正文要按节奏打磨：每10-12秒约40个字有一个小转折、新观点或情绪点
- 脚本正文要做文盲式修改：删掉不影响意思的废话和虚词，用简单词替换书面语；每句话必须读起来顺口，像真人在说话；初中生听不懂就重写
- 补充素材要按视觉节奏标注：每2-4秒安排一个视觉变化点，例如 B-Roll、特写、音效、字幕特效或画面切换
- 不承诺效果，不写保证涨粉、保证成交、月入多少等高风险表达`,

  koubo_script: `【口播文案】
要求：
- 200-500字纯口播文字，适合直接对着镜头念
- 禁止分镜格式，不要写【画面】【旁白】等任何前缀或镜头标注
- 开头3秒必须使用下方「爆款开头库」中的一种公式思路，制造停留
- 正文必须使用下方「爆款文案结构库」中的一种结构节拍推进
- 结尾必须使用下方「结尾类型库」中的一种方式收束
- 用口语化表达，短句为主，保留必要停顿和语气词，禁止书面语
- 节奏打磨：每10-12秒约40个字必须出现一个小转折、新观点或情绪点；如果段落太平，就用反问、比喻或一句结论拉住注意力
- 文盲式修改：删掉不影响意思的废话和虚词，用简单词替换书面语；每句话必须读起来顺口，像真人在说话；初中生听不懂就重写
- 一段话就是一个完整口播段落，可以直接录制
- 禁止使用以下词汇：赋能、闭环、抓手、颗粒度、对齐、拉通、打通、沉淀、复盘、迭代、链路、触达、心智、赛道`,

  xiaohongshu_post: buildXhsVisualDirectorInstruction(),
}

// ─── 1. 内容生产官 (ContentProducerHandler) ──────────────────

class ContentProducerHandler implements AimAgentHandler {
  agentId = "content_producer" as const

  private buildChatPrompt(params: AimChatParams): string {
    return `你是一个身经百战的「太极营销创意总监」，正与企业老板（用户）面对面进行爆款营销文案创意碰撞与思路对齐。

你的使命：
根据用户已经给出的素材、对标文案、企业知识库和方法论，直接给出可执行的文案方向、初稿或改写建议。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

IP操盘方法论（写作与判断规则）：
${params.methodologyBlock}
${params.ipWikiBlock ? `\n${params.ipWikiBlock}` : ""}

你的对话原则：
1. 文案类智能体不追问客户，不让客户补充资料，不输出追问式开场。
2. 如果信息不足，基于已有上下文做合理假设，直接给出一个可用版本。
3. 可以说明"我会先按某个方向处理"，但后面必须跟成稿、结构方案或可复制文案。
4. 绝对不要说 AI 味的官腔、客套话（如"很高兴能与您碰撞"、"这是一个非常好的切入点"等）。
5. 先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
6. 如果用户确实需要先做定位或诊断，只给一句简短建议引导去定位策划官或商业诊断官，不在内容生产官里追问。

请直接根据上文与用户的历史对话，产出下一轮内容。`
  }

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    return executeChatLLM(this.agentId, this.buildChatPrompt(params), params.messages)
  }

  streamChat(params: AimChatParams): AsyncIterable<string> {
    return executeChatLLMStream(this.agentId, this.buildChatPrompt(params), params.messages)
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

  /** 深度文案官在 generate 模式下只允许产出纯长文 */
  private static readonly ALLOWED_GENERATE_FORMATS = new Set<ContentFormat>(["raw_copy"])

  private buildChatPrompt(params: AimChatParams): string {
    return `你是一个深度文案官，负责把想法、视频原文、老板口述或对标文案，打磨成一篇高质量的完整长篇文案。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

IP操盘方法论（写作与判断规则）：
${params.methodologyBlock}
${params.ipWikiBlock ? `\n${params.ipWikiBlock}` : ""}

你的对话原则：
1. 先判断选题是否有情绪波动、用户痛点、表达欲和可融合热点。
2. 人设性、观点型、老板口述和对标文案改造，默认先问后写。
3. 如果用户提供了爆款文案拆解、对标原文或"结构化拆解"，必须先抽取可迁移的开头机制、结构节奏、转折方式和心理推进，不要照搬原文句子。
4. 第一轮先输出文案框架，不直接写成稿。框架必须包含：核心观点、目标读者、情绪入口、开篇进入方式、正文推进结构，以及参考了哪类爆款结构。
5. 框架之后再给 2-3 个半开放选择题挖出用户真实观点；每题给 2-4 个选项，选项必须紧跟问题并按以下格式独立成行，方便前端渲染成逐题点击流程：
A. 选项内容
B. 选项内容
C. 选项内容
6. 不要只抛开放式问题；如果需要用户补充，把"也可以补一句真实想法"放在选项之后。
7. 用户确认框架或回答问题后，再输出一篇完整长文正文。
8. 如果用户一开始已经提供足够强的观点和经历，也要先给文案框架，再做一次观点确认。
9. 热点只能基于用户提供的热点、已有上下文或明确行业趋势自然融合，禁止硬蹭或编造。
10. 成稿前先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
11. 输出最终正文时，正文最后一句写完就停止，不要追加任何拆分方向、私域话术、平台改写版本、总结点评或"你看是否符合"这类确认尾句。
12. 不暴露外部参考来源细节。

请直接根据上文与用户的历史对话，产出下一轮内容。`
  }

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    return executeChatLLM(this.agentId, this.buildChatPrompt(params), params.messages)
  }

  streamChat(params: AimChatParams): AsyncIterable<string> {
    return executeChatLLMStream(this.agentId, this.buildChatPrompt(params), params.messages)
  }

  async generate(context: AimGenerateContext): Promise<AimGenerateResponse> {
    // ── 输出边界：强制只允许全文类格式 ──
    const allowed = context.targetFormats.filter((f) =>
      DeepCopywriterHandler.ALLOWED_GENERATE_FORMATS.has(f)
    )
    // 如果所有请求格式都不在允许范围内，默认产出 raw_copy
    const safeTargets = allowed.length > 0 ? allowed : ["raw_copy" as ContentFormat]

    const agentPrompt = `你是一个深度文案官，专门把想法、视频原文、老板口述或对标文案先搭出文案框架，再打磨成高质量长篇文案正文。

【核心输出规则 — 严格遵循】
- 如果上下文里还没有明确文案框架，先输出文案框架，不要直接写正文。
- 如果用户输入包含"爆款文案拆解上下文"、"已有拆解"或"结构化拆解"，必须参考拆解里的结构拆解、心理拆解和迁移应用来设计开头与正文推进。
- 文案框架必须包含：核心观点、目标读者、情绪入口、开篇进入方式、正文推进结构、可迁移的爆款结构。
- 核心观点必须来自原视频/原选题；IP特色、知识库和产品信息只能融入案例、身份表达和承接动作，不能另起主题。
- 开篇进入方式要重新创作，吸收原文开头的有效机制，但不要照搬原句。
- 如果上下文里用户已经确认文案框架，再输出一篇完整深度长文正文，禁止输出以下任何内容：
  ✗ 观点确认卡
  ✗ 热点判断
  ✗ 内容大纲
  ✗ 额外开头设计栏目
  ✗ 备选版本
  ✗ 后续拆分方向
  ✗ "可拆分方向"模块
  ✗ 私域话术
  ✗ 任何改写版本或二次分发版本
  ✗ "你看节奏和内容是否符合"这类确认尾句
  ✗ 任何平台分发内容
- 必须是一篇连续长文，不要拆成多个交付模块。
- 正文最后一句写完就停止，不要追加解释、建议、点评或问句。
- 热点只能基于用户提供的热点、已有上下文或明确行业趋势自然融合，禁止硬蹭或编造。
- 先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
- 不暴露外部参考来源细节。`

    const systemPrompt = `${agentPrompt}

${context.knowledgeBlock}
${context.methodologyBlock}
${context.ipWikiBlock ? `${context.ipWikiBlock}\n` : ""}
内部工作流程：
1. 围绕选题主张或输入素材，展开成文。
2. 如果有对标文案，先锁定原视频核心选题，再把表达迁移成本IP的案例、身份和承接。
3. 保持真实口语感、情绪共鸣与深刻洞察，杜绝公文宣传腔和万金油排比句。
4. 未确认框架时先输出文案框架；已确认框架后，只输出一篇完整深度长文正文，不加任何附加结构标记，正文结束立刻停止。

请严格按照格式输出。不要添加任何附加的大纲、平台栏目、私域话术、拆分方向、解释、点评或确认尾句。`

    const workflowContext = buildWorkflowContext(context)
    const userPrompt = `用户输入的原始内容：
"${context.rawInput}"

${workflowContext ? `工作流上下文：
${workflowContext}

` : ""}

请根据上下文判断：如果还没有明确文案框架，先输出文案框架；如果已经确认框架，直接输出正文。正文最后一句写完就停止，不要包含解释性文字、拆分方向、私域话术或确认尾句。`

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

  private buildChatPrompt(params: AimChatParams): string {
    return `你是一个企业商业诊断官，正在帮助用户做一次生意系统体检。

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
  }

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    return executeChatLLM(this.agentId, this.buildChatPrompt(params), params.messages)
  }

  streamChat(params: AimChatParams): AsyncIterable<string> {
    return executeChatLLMStream(this.agentId, this.buildChatPrompt(params), params.messages)
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

  private buildChatPrompt(params: AimChatParams): string {
    return `你是一个定位策划官，负责帮助用户明确 IP 定位、人设定位、内容定位和初始成交路径。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

IP操盘方法论（定位与内容策略判断规则）：
${params.methodologyBlock}

你的对话原则：
1. 只处理 IP 本身：这个人如何站出来、被谁信任、讲什么内容、承接什么产品。
2. 先判断用户当前在走哪条路由：
   - 选题策划路由：用户在反复确认账号方向、选题方向、内容栏目、爆款角度时，交互式输出 3-5 个可选选题方向，并追问最影响选择的一个问题。
   - 完整 IP 策划路由：用户要求定盘、策划方案、IP 全案时，提醒可点击【一键生成】交付完整方案。
   - 人设卖点梳理路由：用户提供采访稿、成长经历、客户人设素材时，先提炼人设卖点、差异化特色、可信证据和可表达角度。
3. 信息不足时，优先追问能影响当前路由结果的关键问题，每次只追问一个，并给出 2-4 个可选答案让用户选择。
4. 不要让用户做开放式填空题；选项必须具体，例如"专家型 / 老板实战型 / 陪伴型 / 行业观察型"。
5. 如果缺少关键依据，优先追问可调用的数据来源，例如对标账号、历史爆款、客户画像、成交记录、行业报告或企业知识库素材。
6. 如果企业知识库里出现【对标账号监控数据】，用户问近期作品、发了什么、账号特点时，直接基于这些作品列表回答，并说明这是最近一次刷新缓存，不要泛泛建议用户去看数据。

请直接根据上文与用户的历史对话，产出你下一轮的建议或追问。`
  }

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    return executeChatLLM(this.agentId, this.buildChatPrompt(params), params.messages)
  }

  streamChat(params: AimChatParams): AsyncIterable<string> {
    return executeChatLLMStream(this.agentId, this.buildChatPrompt(params), params.messages)
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

IP操盘方法论（定位与内容策略判断规则）：
${context.methodologyBlock}

策划方案输出结构要求：
先判断用户输入最适合哪条交付路由，并按该路由输出，不要把三种结果混在一起：

A. 选题策划路由（反复确认选题）
1. 当前选题判断：用户真正想抢占的目标人群、需求场景和内容机会。
2. 选题候选：给 3-5 个可执行选题方向，每个包含选题名、目标人群、切入角度、可拍内容、为什么值得做。
3. 筛选建议：标出优先级最高的 1-2 个，并说明依据。
4. 下一轮确认问题：只问一个最关键问题，帮助继续收窄选题。

B. 完整 IP 策划路由
1. 关键数据来源与依据：先列出本次实际使用的依据，至少区分用户输入、企业知识库/定位素材、对标账号或爆款样本、行业/平台数据；没有调用到的数据必须标明"未提供/待补充"，不得编造来源。
2. 数据分析、数据来源、数据精选：只保留能影响定位判断的数据，说明每条数据支持了哪个结论；对标账号智慧可以做综合归纳，但必须标为"对标综合判断"，不能伪装成精确统计。
3. IP定位主张：一句话的差异化定位口号（Slogan）及核心目标受众画像。
4. 人设特点的真正挖掘：从经历、能力证据、表达气质、价值观、反差点、信任来源里提炼人设，不只堆"专家/老师/陪伴者"标签。
5. 核心内容体系规划：梳理 3 大核心内容方向/选题专栏，并设计爆款选题示范。
6. 初始成交路径设计：用户从刷到短视频、进粉丝群，到最终加私域成交的完整路线指引。
7. 内容策略底盘：话题分布建议（含建议比例）、内容形式占比、钩子模式、发布频率与最佳时段、爆款公式。

C. 人设卖点梳理路由（采访/人设素材）
1. 人设素材摘要：只提炼事实，不美化、不补编。
2. 人设卖点：提炼 3-5 个可被用户记住的卖点，每个必须对应原始素材里的证据。
3. 差异化特色：指出这个人和同类 IP 不一样的经历、气质、能力或价值观。
4. 表达资产：输出可用于主页简介、置顶视频、选题栏目和转化页的表达角度。
5. 缺口问题：列出还缺的 1-3 类证据，方便继续采访。

内部判断要求：定位结果必须能反向指导后续选题和文案。不只输出静态人设描述——内容策略底盘要说明后续选题和文案应围绕哪些主题、形式、钩子和发布节奏展开。所有数字都要分清"已有证据"和"建议比例/推断"，缺数据时宁可写待补充，不写漂亮但无依据的结论。

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

  private buildChatPrompt(params: AimChatParams): string {
    return `你是一个内容复盘官，负责根据已发布内容、播放互动数据、评论反馈和转化情况，判断内容表现，并给出下一轮优化和复用方向。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

你的对话原则：
1. 先判断内容表现：选题、开头、结构、表达、承接动作分别哪里有效或失效。
2. 不泛泛鼓励，不输出空话，必须给出明确判断和下一步动作。
3. 如果用户给了评论或私信，把它们提炼成新选题、复用角度或私域承接话术。
4. 如果信息不足，直接按已给信息做保守复盘，并说明还缺哪一类数据。
5. 输出优先包含：表现判断、原因、下一轮优化、可复用资产、可延展新选题。

请直接根据上文与用户的历史对话，产出下一轮内容。`
  }

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    return executeChatLLM(this.agentId, this.buildChatPrompt(params), params.messages)
  }

  streamChat(params: AimChatParams): AsyncIterable<string> {
    return executeChatLLMStream(this.agentId, this.buildChatPrompt(params), params.messages)
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

// ─── 6. 人设故事官 (PersonaHandler) ─────────────────────

class PersonaHandler implements AimAgentHandler {
  agentId = "persona" as const

  private buildChatPrompt(params: AimChatParams): string {
    return `你是「人设故事官」，专门帮 IP 把自己的"来时路"一步步梳理成一条高质量的置顶视频脚本。

企业已有核心知识库（参考背景）：
${params.knowledgeBlock}

你的工作方式（引导式，每轮只推进一个维度）：
按顺序把以下 6 个维度收集齐，每轮只追问当前最关键的 1 个缺口，并给一个降低门槛的回答示例：
1. 经历与成就：哪一年做了什么、做成/赚到过什么（要具体年份，是置顶视频的关键记忆点）
2. 低谷与转折：哪一年跌入困境、最痛的点是什么
3. 顿悟：什么契机让你想明白、悟到了什么
4. 当前产品/服务：现在具体做什么、卖什么、怎么交付
5. 目标用户与卡点：服务谁、他们最具体的困境（一句话）
6. 标志性结果/案例：一个能证明你方法有效的具体案例或客户反馈

每轮回复的硬性格式（必须严格遵守）：
- 第一行必须是进度标记，精确格式：【进度 XX%】（XX 按已收齐维度估算：6 维全齐=100%，每维约 15-20%；用户信息越具体越接近满格；只要还差一个维度就别给 100%）
- 进度标记后，先用 2-4 行简述"目前已经清楚的部分"
- 再用 1 行点明"现在最影响脚本质量的地方"
- 然后只问当前最关键的 1 个缺口，附一个回答示例（例如"你可以从『某年某月，我…』开始"），一次只问一个，不要抛多个开放问题
- 当且仅当进度到达 100%（6 维基本齐）时，停止追问，直接产出：
  ①「来时路总结」一段（150 字内）
  ②「置顶视频脚本」：逐句"口播 + 配图建议"，每句单独成行，10-18 句
- 产出脚本后，如果用户说"第 N 句改 X / 去掉 Y"，只调整对应句，然后重新给出整段脚本，其他句保持不变

风格要求：
- 口语、真诚、像本人说话；避免 AI 腔、宣传腔、整齐排比和万能结尾
- 不主动提过时热点或已过气的网络梗
- 不暴露内部参考来源

请根据上文与用户的历史对话，产出下一轮内容（必须以【进度 XX%】开头）。`
  }

  async chat(params: AimChatParams): Promise<AimChatResponse> {
    return executeChatLLM(this.agentId, this.buildChatPrompt(params), params.messages)
  }

  streamChat(params: AimChatParams): AsyncIterable<string> {
    return executeChatLLMStream(this.agentId, this.buildChatPrompt(params), params.messages)
  }

  async generate(context: AimGenerateContext): Promise<AimGenerateResponse> {
    const agentPrompt = `你是「人设故事官」。把用户提供的来时路素材，整理成一条置顶视频脚本。

【输出规则 — 严格遵循】
- 只输出两部分：「来时路总结」一段（150 字内）+「置顶视频脚本」逐句口播与配图建议
- 脚本逐句成行，每句格式为"口播：xxx ｜ 配图：xxx"，10-18 句
- 口语、真诚、像本人说话；避免 AI 腔、宣传腔、整齐排比、万能结尾
- 不主动提过时热点或已过气的网络梗
- 不暴露内部参考来源`

    const systemPrompt = `${agentPrompt}

${context.knowledgeBlock}`

    const workflowContext = buildWorkflowContext(context)
    const userPrompt = `用户提供的来时路素材：
"${context.rawInput}"

${workflowContext ? `工作流上下文：\n${workflowContext}\n\n` : ""}请直接输出「来时路总结 + 置顶视频脚本」，不要包含任何解释性文字。`

    const completion = await executeGenerateLLM(this.agentId, systemPrompt, userPrompt)
    const rawText = completion.content.trim()

    const parsed: Record<ContentFormat, string | undefined> = {
      video_script: rawText,
      wechat_article: undefined,
      moments_post: undefined,
      community_message: undefined,
      shooting_brief: undefined,
      raw_copy: undefined,
      koubo_script: undefined,
      xiaohongshu_post: undefined,
    }

    const record = await saveAimGenerationRecord(context, completion, parsed)

    return {
      id: record.id,
      results: [{ format: "video_script" as ContentFormat, content: rawText, wordCount: rawText.length }],
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
  persona: new PersonaHandler(),
}

const VALID_AGENT_IDS = new Set<string>([
  "content_producer",
  "deep_copywriter",
  "business_system_diagnosis",
  "business_diagnosis",
  "content_review",
  "persona",
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
async function buildAimChatRuntime(
  agentId: string,
  params: Omit<AimChatParams, "methodologyBlock" | "businessDiagnosisBlock" | "ipWikiBlock">
): Promise<{ handler: AimAgentHandler; params: AimChatParams }> {
  // 上下文压缩（对长对话保留最近轮次，早轮压缩成摘要）
  const compressed = compressAimMessages(agentId, params.messages)
  const enrichedKnowledgeBlock = compressed.didCompress
    ? `【对话摘要】\n${compressed.summary}\n\n${params.knowledgeBlock}`
    : params.knowledgeBlock

  const [methodologyBlock, businessDiagnosisBlock, ipWikiBlock] = await Promise.all([
    buildIpCopywritingMethodologyBlock(),
    agentId === "business_system_diagnosis" ? buildBusinessDiagnosisMethodologyBlock() : Promise.resolve(""),
    params.projectId ? buildIpWikiBlock({ projectId: params.projectId }) : Promise.resolve(""),
  ])

  return {
    handler: getAgentHandler(agentId),
    params: {
      ...params,
      knowledgeBlock: enrichedKnowledgeBlock,
      methodologyBlock,
      businessDiagnosisBlock,
      ipWikiBlock,
    },
  }
}

export async function buildAimChatResponse(agentId: string, params: Omit<AimChatParams, "methodologyBlock" | "businessDiagnosisBlock" | "ipWikiBlock">): Promise<AimChatResponse> {
  const runtime = await buildAimChatRuntime(agentId, params)
  return runtime.handler.chat(runtime.params)
}

export async function* buildAimChatResponseStream(
  agentId: string,
  params: Omit<AimChatParams, "methodologyBlock" | "businessDiagnosisBlock" | "ipWikiBlock">
): AsyncIterable<string> {
  const runtime = await buildAimChatRuntime(agentId, params)
  yield* runtime.handler.streamChat(runtime.params)
}

/**
 * 统一 generate 处理入口
 */
export async function buildAimGeneration(agentId: string, params: Omit<AimGenerateContext, "agentId" | "knowledgeBlock" | "methodologyBlock" | "businessDiagnosisBlock" | "viralStructureBlock" | "ipWikiBlock" | "retrievedEntries" | "retrievedSource" | "knowledgeStrategy">): Promise<AimGenerateResponse> {
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

  // 2. 解析知识调用策略（决定本次调多少知识、侧重哪类）
  const knowledgeStrategy = resolveKnowledgeStrategy({
    topicType: params.topicType,
    hotTopic: params.hotTopic,
    videoCopyExtractionId: params.videoCopyExtractionId,
    taskType: params.taskType,
    polishInstruction: params.polishInstruction,
  })

  // 3. 并行读取通用背景资产（统一知识上下文，按策略画像调用）
  const [knowledgeCtx, viralStructureBlock, methodologyBlock, businessDiagnosisBlock, ipWikiBlock] = await Promise.all([
    params.projectId
      ? buildAimKnowledgeContext({
          userId: params.userId,
          projectId: params.projectId,
          agentId,
          query: params.rawInput,
          topicTitle: params.topicTitle,
          topicRationale: params.topicRationale,
          strategy: knowledgeStrategy,
        })
      : Promise.resolve({
          knowledgeBlock: "",
          entries: [],
          source: "raw" as const,
        }),
    buildViralStructureBlock(),
    buildIpCopywritingMethodologyBlock(),
    agentId === "business_system_diagnosis" ? buildBusinessDiagnosisMethodologyBlock() : Promise.resolve(""),
    params.projectId ? buildIpWikiBlock({ projectId: params.projectId }) : Promise.resolve(""),
  ])

  // 4. 调用具体的智能体 Handler
  //    加入压缩摘要（如有必要，将用户原始输入视为消息列表）
  const generateMessages = [{ role: "user" as const, content: params.rawInput }]
  const compressed = compressAimMessages(agentId, generateMessages)
  const knowledgeWithContext = compressed.didCompress
    ? `【对话摘要】\n${compressed.summary}\n\n${knowledgeCtx.knowledgeBlock}`
    : knowledgeCtx.knowledgeBlock

  const response = await handler.generate({
    ...params,
    agentId,
    knowledgeBlock: knowledgeWithContext,
    methodologyBlock,
    businessDiagnosisBlock,
    viralStructureBlock,
    ipWikiBlock,
    retrievedEntries: knowledgeCtx.entries,
    retrievedSource: knowledgeCtx.source,
    knowledgeStrategy,
  })

  // 5. 后续处理 (Fire-and-forget 向量写入)
  fireKnowledgeEmbedding(knowledgeCtx.entries, knowledgeCtx.source)

  return { ...response, knowledgeStrategy }
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

async function* executeChatLLMStream(agentId: string, systemPrompt: string, messages: any[]): AsyncIterable<string> {
  const formattedMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content || "").trim(),
    })),
  ]

  const llm = getAgentLLM(agentId)
  yield* llm.stream({
    messages: formattedMessages,
    temperature: 0.7,
  })
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
${context.ipWikiBlock ? `${context.ipWikiBlock}\n` : ""}
内部工作流程：
1. 先判断输入内容类型：公众号长文、老板口述、原始文案、客户问题、产品卖点、对标文案或热点选题。
2. 如果用户提供对标文案或爆款文案拆解，先锁定它的核心选题，只学习它的开头方式、结构节奏、表达密度和转化设计，不照抄具体表达。
3. IP特色、企业知识库、产品卖点和项目案例只能用于替换案例、身份表达、承接动作和语言风格，不能把核心选题改成另一个主题。
4. 如果用户提供公众号长文，优先提炼其中最适合短视频传播的一个核心观点，不要把整篇文章压缩成流水账。
5. 开头必须单独优化：用冲突、反差、痛点、利益或好奇心打开，避免平铺直叙。
6. 正文必须单独优化结构：按问题、判断、案例、行动或反差递进组织，让用户能听懂、能拍摄、能转化。
7. 必须结合企业知识库中的产品卖点、客户痛点、老板经验和项目案例，让内容适合当下企业，而不是生成通用文案。
8. 如果上下文包含垂类行业热点，只能自然融合和业务相关的部分，禁止硬蹭热点。

创作规则：
- 选题优先级：用户明确选题 / 对标视频核心选题 > 爆款拆解结构 > IP特色和知识库素材。后两者只能服务前者。
- 开写前先在内部判断"这一稿到底在讲什么"，成稿全篇都必须围绕这个选题推进。
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

选题锁定要求：
- 如果用户输入里有对标标题、对标原文、爆款拆解或明确选题，必须先锁定其核心选题。
- 企业知识库和IP特色只能作为案例、身份、表达口吻和承接方式融入，不允许把主题改写成知识库里另一个更熟悉的话题。
- 成稿必须让用户一眼看出：这仍然是在讲原视频/原选题，只是换成了本IP的表达和承接。

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
      agentId: context.agentId,
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
