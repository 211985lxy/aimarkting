import type { AimAgentId } from "@/lib/aim-ui-config"
import { normalizeAimAgentId } from "@/lib/aim-ui-config"

export interface AimInputTemplateField {
  label: string
  placeholder: string
}

export interface AimNextAction {
  id: string
  label: string
  targetAgentId?: AimAgentId
  prompt: string
}

export interface AimCopyVariant {
  id: string
  label: string
  prompt: string
}

export interface AimAgentGuide {
  intro: string
  placeholder: string
  defaultInstruction: string
  quickPrompts: string[]
  primaryActionLabel: string
  scenarios: string[]
  inputTemplate: AimInputTemplateField[]
  outputAssets: string[]
  nextActions: AimNextAction[]
  copyVariants?: AimCopyVariant[]
}

export const AIM_COPY_VARIANTS: AimCopyVariant[] = [
  { id: "monologue", label: "独白流", prompt: "请按独白流结构生成：经历/观察进入，情绪递进，最后落到我的观点和行动引导。" },
  { id: "conclusion_first", label: "结论先行", prompt: "请按结论先行结构生成：第一句先给判断，再拆原因、场景和建议。" },
  { id: "qa", label: "问答型", prompt: "请按问答型结构生成：用户提问，我用真实口语回答，适合老板 IP 或专家 IP。" },
]

const BASIC_INPUT_TEMPLATE: AimInputTemplateField[] = [
  { label: "我是谁", placeholder: "行业/身份/门店类型" },
  { label: "产品服务", placeholder: "具体产品、服务或交付" },
  { label: "目标客户", placeholder: "客户是谁，他们最焦虑什么" },
  { label: "核心卖点", placeholder: "最多 3 个真实优势" },
  { label: "内容目标", placeholder: "涨粉/咨询/到店/成交/建立信任" },
  { label: "对标参考", placeholder: "可粘贴对标文案、爆款拆解或账号打法" },
]

export const AIM_AGENT_GUIDES: Record<AimAgentId, AimAgentGuide> = {
  content_producer: {
    intro: "我是你的内容生产官。选题、脚本、朋友圈、长文和发布前质检都在这里处理，先把素材、主题或老板口述丢进来。",
    placeholder: "说说今天要生产什么内容：选题、原始想法、老板口述、客户问题都可以…",
    defaultInstruction: "去 AI 味，保留真人表达的犹豫、判断和具体细节，少用套话。先判断内容类型，再输出适合发布的内容交付物。",
    quickPrompts: [
      "把这个选题写成短视频口播，并顺手给一版朋友圈承接。",
      "粘贴老板在会上的金句片段，整理成可拍脚本和拍摄交接单。",
    ],
    primaryActionLabel: "生成内容",
    scenarios: ["已有选题或素材", "要生成口播/朋友圈/社群文案", "把对标爆款迁移成自己的内容"],
    inputTemplate: BASIC_INPUT_TEMPLATE,
    outputAssets: ["口播文案", "拍摄交接单", "朋友圈/社群承接", "发布包"],
    copyVariants: AIM_COPY_VARIANTS,
    nextActions: [
      { id: "publish_package", label: "生成发布包", prompt: "请基于下面成稿，整理抖音发布标题、发布文案和发布话题。话题里至少包含一个账号/品牌/IP 相关话题。" },
      { id: "publish_check", label: "发布前自查", prompt: "请对下面成稿做抖音发布前自查，只给风险、最小改法和复检建议。" },
      { id: "to_deep_copywriter", label: "带入深度文案官", targetAgentId: "deep_copywriter", prompt: "请把下面成稿扩展成一篇有框架、有观点、有真人表达的长篇文案。" },
      { id: "save_knowledge", label: "保存为档案素材", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  deep_copywriter: {
    intro: "我是你的深度文案官。把想法、视频原文、老板口述或对标文案给我，我只做纯粹的长篇文案创作，先搭框架，再写成一篇完整长文。",
    placeholder: "粘贴想法、视频原文、老板口述、对标文案或想借势的热点，我先帮你搭文案框架…",
    defaultInstruction: "只做长篇文案创作。先输出文案框架，包含核心观点、目标读者、情绪入口、正文推进结构、开头方向；再用2-3个半开放选择题挖出用户真实观点。每题选项必须按 A. / B. / C. / D. 独立成行输出，方便用户点击。用户确认框架后，只输出一篇完整长文正文，正文结束立刻停止；不输出拆分方向、私域话术、任何平台分发内容或“你看是否符合”这类确认尾句。热点只能自然融合，禁止硬蹭或编造。",
    quickPrompts: [
      "根据这段视频原文，先搭文案框架，再打磨成适合我表达的一篇长文。",
      "我有一个观点，先帮我挖出真实态度，再写成开头有力量、结构完整的一篇长文。",
    ],
    primaryActionLabel: "生成长篇文案",
    scenarios: ["老板口述很散", "对标文案需要深度再创作", "要先搭框架再写长文"],
    inputTemplate: BASIC_INPUT_TEMPLATE,
    outputAssets: ["文案框架", "完整长文", "观点确认问题"],
    nextActions: [
      { id: "to_content_producer", label: "带入内容生产官", targetAgentId: "content_producer", prompt: "请把下面长文拆成一条适合抖音口播的短视频文案。" },
      { id: "publish_package", label: "生成发布包", prompt: "请基于下面文案，整理发布标题、发布文案和发布话题。" },
      { id: "save_knowledge", label: "保存为档案素材", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  business_diagnosis: {
    intro: "我是你的定位策划官。告诉我你的产品、卖给谁、目前怎么获客、卡在哪，我会输出 IP 定位、内容定位和成交路径建议。",
    placeholder: "说说你的主营业务、目标客户，以及当前获客卡在哪…",
    defaultInstruction: "从定位清晰度、痛点匹配度、成交链路顺畅度三个维度进行诊断，给出具体且可落地的改进建议，采用诊断报告格式。",
    quickPrompts: [
      "ERP 软件定位诊断：客单价 5 万，目前依赖熟人转介绍，怎么开启线上精准获客？",
      "社区宠物店引流：周边有竞品竞争，客单价和复购率双低，如何破局？",
      "基于我的 IP 方法论四类选题，规划一套可日更的 100 条选题库。",
    ],
    primaryActionLabel: "生成诊断报告",
    scenarios: ["还没想清楚账号定位", "客户画像和成交路径不清楚", "需要日更 100 条选题"],
    inputTemplate: BASIC_INPUT_TEMPLATE,
    outputAssets: ["IP 定位建议", "内容定位", "成交路径", "100 条选题库"],
    nextActions: [
      { id: "to_content_producer", label: "带入内容生产官", targetAgentId: "content_producer", prompt: "请基于下面定位策划，生成 3 个可拍选题，并先写第 1 条口播文案。" },
      { id: "save_knowledge", label: "保存为档案素材", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  business_system_diagnosis: {
    intro: "我是你的商业诊断官。告诉我业务类型、现状数据、卡点和目标，我会诊断商业模式、流量转化、交付结构和核心矛盾。",
    placeholder: "说说你的业务、目前数据、卡在哪、想达到什么结果…",
    defaultInstruction: "按商业诊断官结构输出：业务现状说明、模糊概念澄清、生意系统四层诊断、核心矛盾判断、行业参照校验、多视角复核、三条调整路径、本周最小动作。",
    quickPrompts: [
      "老板 IP 做了三个月没成交，帮我诊断问题。",
      "工程服务账号有播放但没客户，帮我找核心矛盾。",
      "我有产品但不知道怎么获客和成交，帮我做生意体检。",
    ],
    primaryActionLabel: "生成诊断报告",
    scenarios: ["业务卡住了", "流量和成交不匹配", "需要先找核心矛盾"],
    inputTemplate: BASIC_INPUT_TEMPLATE,
    outputAssets: ["商业诊断报告", "核心矛盾", "调整路径", "本周动作"],
    nextActions: [
      { id: "to_business_diagnosis", label: "带入定位策划官", targetAgentId: "business_diagnosis", prompt: "请基于下面商业诊断结果，生成一份《天命IP资产化操盘全案》，走天命IP资产化操盘全案路由（12 模块）：项目总判断、天命底盘、IP主定位、目标客户、核心问题、IP价值、产品设计、内容系统、流量闭环、私域成交、交付资产化、行动处方。天命底盘没有命理资料时写「未提供/待补充」，不编造。每个模块要能指导后续选题、文案、产品承接、私域成交和交付资产化。" },
      { id: "save_knowledge", label: "保存为档案素材", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  content_review: {
    intro: "我是你的发布质检官。把准备发布的文案贴给我，我会检查四维质量、平台风险、AI味和最小改法，不会把整篇稿子推倒重写。",
    placeholder: "贴一版准备发布的口播、脚本或正文，我帮你做发布前自查…",
    defaultInstruction: "按发布前质检结构输出：总体结论、必改问题、平台风险、AI味/表达问题、最小修改建议、复检清单。只给最小改法，不要整篇重写。",
    quickPrompts: [
      "帮我检查这版口播能不能直接发，哪些地方必须改。",
      "帮我做抖音发布前自查，只给最小修改建议。",
    ],
    primaryActionLabel: "生成质检报告",
    scenarios: ["文案准备发布", "担心违规或限流", "只想要最小修改建议"],
    inputTemplate: [{ label: "待质检文案", placeholder: "粘贴完整口播、脚本或正文" }],
    outputAssets: ["发布前质检报告", "平台风险", "最小改法", "复检清单"],
    nextActions: [
      { id: "recheck", label: "复检修改稿", prompt: "请对下面修改稿做复检，只指出仍需修改的位置和原因。" },
      { id: "save_knowledge", label: "保存质检报告", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  persona: {
    intro: "我来一步步帮你梳理来时路：经历成就 → 低谷转折 → 顿悟 → 现在的产品 → 目标用户 → 标志案例。聊完直接给你置顶视频脚本，还能逐句改。",
    placeholder: "想到什么说什么，乱也没关系。从『某年某月，我…』开始最省事…",
    defaultInstruction: "引导式：每轮只追问一个最关键的缺口并给回答示例，回复必须以【进度 XX%】开头；6 维收齐（100%）后产出『来时路总结 + 逐句口播与配图的置顶视频脚本』；用户说『第N句改X』时只改对应句。口语真诚，避免 AI 腔和过时热点。",
    quickPrompts: [
      "从『某年某月，我出生在…』开始讲我的来时路",
      "我想做一条置顶视频讲清楚我是谁、为什么做现在这件事",
    ],
    primaryActionLabel: "梳理来时路",
    scenarios: ["要讲清楚我是谁", "想做人设故事", "需要置顶视频脚本"],
    inputTemplate: [
      { label: "经历起点", placeholder: "某年某月，我..." },
      { label: "低谷转折", placeholder: "最难的一段经历和变化" },
      { label: "现在业务", placeholder: "现在做什么，服务谁" },
    ],
    outputAssets: ["来时路总结", "人设故事", "置顶视频脚本"],
    nextActions: [
      { id: "to_content_producer", label: "带入内容生产官", targetAgentId: "content_producer", prompt: "请基于下面人设故事，生成一条置顶视频口播文案。" },
      { id: "save_knowledge", label: "保存为档案素材", prompt: "保存为 AIM 档案素材。" },
    ],
  },
}

export function getAimAgentGuide(agentId: string): AimAgentGuide {
  // 归一化旧别名（ip_video → content_producer），兼容历史调用
  return AIM_AGENT_GUIDES[normalizeAimAgentId(agentId) as AimAgentId]
}

export function buildAimGuideTemplate(fields: AimInputTemplateField[]): string {
  return fields.map((field) => `${field.label}：${field.placeholder}`).join("\n")
}

export function buildAimNextActionPrompt(action: AimNextAction, content: string): string {
  return `${action.prompt}\n\n---\n${content.trim()}\n---`
}
