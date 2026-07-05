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

export interface AimWorkbenchSkill {
  id: string
  label: string
  description: string
  prompt: string
  agentId?: AimAgentId
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
  skills: AimWorkbenchSkill[]
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

const PUBLISH_PLAN_PROMPT = [
  "请基于下面内容生成发布计划，不要自动发布。",
  "固定输出：当前稿发布标题、当前稿发布文案、当前稿发布话题，话题里至少包含 1 个品牌/IP/账号相关话题。",
  "再输出一张「12 条内容排产表」，每条必须包含：序号、选题标题、核心钩子、内容角度、适合平台/形式、发布话题、承接动作。",
  "内容裂变规则：如果输入是目标人群或多个选题，筛选并组织成 12 条发布内容；如果输入是深度长内容，裂变为短视频、小红书、朋友圈/社群等可发布内容；如果输入是单篇成稿，先给本篇发布信息，再扩展 12 条后续排产。",
].join("\n")

const CONTENT_PRODUCER_SKILLS: AimWorkbenchSkill[] = [
  {
    id: "optimize_opening_hook",
    label: "优化开头",
    description: "调用七大爆款开头库，重写前三秒钩子。",
    prompt: "请基于当前文案优化开头：调用七大爆款开头库（好奇、借势、痛点、极限、恐吓、反差、利益输送），只输出 3-5 个可替换开头并标注类型；不要输出正文，不要顺手重写整篇。",
    agentId: "content_producer",
  },
  {
    id: "rewrite_existing_copy",
    label: "改写现有文案",
    description: "保留原意，重写成更像真人表达的版本。",
    prompt: "请基于当前内容改写现有文案：保留核心意思和关键事实，明显去 AI 味，至少 30% 可感知重写，输出一版可直接发布的文案。",
    agentId: "content_producer",
  },
  {
    id: "viral_recreation",
    label: "对标爆款再创作",
    description: "学习选题、钩子和冲突，不照搬原句。",
    prompt: "请基于当前对标内容做爆款再创作：只学习选题逻辑、开头机制、观点冲突和情绪触发，用我的立场、人设、案例和业务场景重构，字数控制在对标原文 95%-105%。",
    agentId: "content_producer",
  },
  {
    id: "hot_topic_copy",
    label: "追热点写内容",
    description: "把热点转成适合账号的观点内容。",
    prompt: "请基于当前热点和我的业务，追热点写一条适合本账号发布的内容：不要硬蹭，先给我的判断，再落到客户场景、业务价值和行动引导。",
    agentId: "content_producer",
  },
  {
    id: "video_diary",
    label: "生成视频日记",
    description: "把经历、现场和感受转成口播日记。",
    prompt: "请基于当前素材生成一条视频日记：必须调用事件内容化五步法「真实事件 -> 关键矛盾 -> 核心观点 -> 用户价值 -> 内容表达」。用第一人称，不写流水账；先还原一个真实现场/经历，再挖出矛盾和情绪变化，最后落到一个对用户有启发、能记住的判断。",
    agentId: "content_producer",
  },
  {
    id: "xiaohongshu_image_text",
    label: "小红书图文笔记",
    description: "生成标题、正文、封面短句和 8 页图文脚本。",
    prompt: "请基于当前素材生成一套小红书图文笔记：复用 AIM 的小红书图文视觉导演结构，输出小红书标题 5 个、封面主标题/副标题、正文、2-5 个话题标签、8 页图文结构、逐页配图脚本、发布前自检。每页只讲一个信息点，手机端一眼读懂，不要写成 PPT 课件；话题里至少包含 1 个品牌/IP/账号相关标签。",
    agentId: "content_producer",
  },
  {
    id: "lead_gen_copy",
    label: "生成获客文案",
    description: "围绕客户痛点和承接动作写成交向内容。",
    prompt: "请基于当前内容生成获客文案：先点出目标客户的真实问题，再给出我的解决思路和服务价值，最后加入自然的承接动作，不要夸大承诺。",
    agentId: "content_producer",
  },
  {
    id: "point_of_view_copy",
    label: "生成观点表达",
    description: "把一个判断写成有立场的短视频口播。",
    prompt: "请基于当前内容生成观点表达：第一句先给明确判断，再解释为什么、适合谁、不适合谁，最后用一句有记忆点的话收尾。",
    agentId: "content_producer",
  },
  {
    id: "core_content_split",
    label: "核心内容一键拆解",
    description: "把一篇核心内容拆成多平台发布物料。",
    prompt: "请基于当前核心内容一键拆解：输出公众号文章/深度长文、短视频口播、小红书图文笔记、朋友圈文案、Vlog 分镜脚本，并补充后续 12 条发布选题。",
    agentId: "content_producer",
  },
  {
    id: "publish_plan_12",
    label: "生成 12 条发布计划",
    description: "生成标题、话题和后续内容排产。",
    prompt: PUBLISH_PLAN_PROMPT,
    agentId: "content_producer",
  },
]

const TOPIC_PLANNING_SKILLS: AimWorkbenchSkill[] = [
  {
    id: "meeting_minutes_asset_pack",
    label: "会议纪要完整资产包",
    description: "需要全量材料时再用。",
    prompt: "请基于当前会议纪要，生成一份高密度《会议纪要内容资产包》。不要做流水账总结，不要结尾反问是否继续。固定输出：1. 会议一句话结论；2. 关键信息抽取表（原话/事实、说话对象或角色、暴露的问题/顾虑/机会、可转成的内容角度、证据强度，至少 8 条，材料不足写实际条数）；3. 核心矛盾/机会（1 个主矛盾 + 2-3 个次矛盾，必须对应会议原话或事实）；4. 可拍选题池（至少 12 条，字段为选题标题、选题类型、目标受众、会议证据、开头钩子、拍摄场景/素材、承接目的）；5. 优先级最高的 3 条；6. 执行清单；7. 采访追问清单；8. 脚本/分镜方向；9. 可沉淀知识库素材；10. 待补充信息。所有结论必须能追溯到会议纪要，缺失信息标注待补充。",
    agentId: "business_diagnosis",
  },
  {
    id: "meeting_minutes_core_topic",
    label: "会议纪要提炼一个核心选题",
    description: "只选一个最值得拍的题，直接交给文案创作。",
    prompt: "请基于当前会议纪要，只提炼一个最值得马上进入文案创作的核心选题。不要输出完整资产包。输出固定为：1. 核心选题标题；2. 为什么只选它；3. 目标受众；4. 开头钩子；5. 内容主线（三段以内）；6. 必用会议原话/事实；7. 文案创作交接说明。最后给一句「可直接带入内容文案创作」。",
    agentId: "business_diagnosis",
  },
  {
    id: "meeting_minutes_task_list",
    label: "生成任务清单",
    description: "把会议结论拆成执行动作。",
    prompt: "请基于当前核心选题和会议纪要，只生成任务清单。不要输出选题库、采访清单或脚本。字段固定为：任务、负责人/角色、截止时间或节奏、输入材料、交付物、验收标准、关联选题。",
    agentId: "business_diagnosis",
  },
  {
    id: "meeting_minutes_interview_list",
    label: "生成采访清单",
    description: "把选题拆成现场采访问题。",
    prompt: "请基于当前核心选题和会议纪要，只生成采访清单。不要输出任务清单或完整脚本。按采访对象分组，字段固定为：采访对象、问题、追问、想拿到的原话/证据、拍摄提醒。",
    agentId: "business_diagnosis",
  },
  {
    id: "meeting_minutes_questionnaire",
    label: "生成问卷表",
    description: "把会议里缺的信息变成可收集问题。",
    prompt: "请基于当前核心选题和会议纪要，只生成问卷表。不要输出选题库或脚本。字段固定为：问题、题型、选项或填空提示、用途、对应选题/判断。问题要短，便于发给客户或一线人员填写。",
    agentId: "business_diagnosis",
  },
  {
    id: "meeting_minutes_script_template",
    label: "生成脚本模板",
    description: "给下一步文案创作用。",
    prompt: "请基于当前核心选题和会议纪要，只生成脚本模板。不要输出多个选题和任务清单。结构固定为：3秒开头钩子、背景交代、三段内容推进、必用会议原话/事实、画面建议、结尾承接。这个结果用于下一步内容文案创作。",
    agentId: "business_diagnosis",
  },
  {
    id: "choose_benchmark",
    label: "选择对标账号 / 对标内容",
    description: "明确该看谁、看什么、借鉴哪一层。",
    prompt: "请基于当前业务和目标客户，帮我选择对标账号/对标内容：说明选择标准、适合参考的内容类型、不能照抄的部分，以及下一步怎么拆解。",
    agentId: "business_diagnosis",
  },
  {
    id: "choose_content_pillar",
    label: "选择内容主线",
    description: "在热点、人设、问题解答和观点中定方向。",
    prompt: "请基于当前内容，帮我选择内容主线：在热点类、人设类、问题解答类、观点类中做判断，并说明每条主线适合的选题方向。",
    agentId: "business_diagnosis",
  },
  {
    id: "persona_story_topics",
    label: "生成人设类选题",
    description: "从经历、转折和价值观里找选题。",
    prompt: "请基于当前素材生成人设类选题：围绕来时路、关键转折、价值观、行业经历和真实案例，输出一组选题池并标注推荐优先级。",
    agentId: "business_diagnosis",
  },
  {
    id: "hot_topic_topics",
    label: "生成热点类选题",
    description: "把行业热点转成账号可讲的内容。",
    prompt: "请基于当前账号资料、对标素材和行业动态生成热点类选题：热点只能辅助，不硬蹭；每条都要说明和本账号、目标客户、产品服务的关系。",
    agentId: "business_diagnosis",
  },
  {
    id: "problem_solution_topics",
    label: "生成问题解答类选题",
    description: "围绕客户正在卡住的问题做选题池。",
    prompt: "请基于当前目标客户生成问题解答类选题：优先选择高频、强痛点、能体现专业能力的问题，客户案例和业务价值也并入这一类，每条给出开头钩子和内容角度。",
    agentId: "business_diagnosis",
  },
  {
    id: "point_of_view_topics",
    label: "生成观点类选题",
    description: "把判断、趋势和立场转成内容方向。",
    prompt: "请基于当前行业和账号定位生成观点类选题：每条都要有明确判断、争议点、旧认知和新认知，不要只复述热点。",
    agentId: "business_diagnosis",
  },
  {
    id: "select_high_potential_topics",
    label: "筛选高潜选题",
    description: "从选题池里挑更容易出结果的题。",
    prompt: "请基于当前选题池筛选高潜选题：按热点类、人设类、问题解答类、观点类归类，再按目标人群痛感、传播冲突、账号匹配度、转化承接、可持续拆分五项评分，选出最值得先做的 12 条。",
    agentId: "business_diagnosis",
  },
]

const REVIEW_SKILLS: AimWorkbenchSkill[] = [
  { id: "title_review", label: "标题质检", description: "检查标题吸引力、准确性和风险表达。", prompt: "请基于当前文案做标题质检：指出标题是否准确、有钩子、是否夸大或违规，并给最小修改建议。", agentId: "content_review" },
  { id: "hook_review", label: "开头钩子质检", description: "检查前三秒是否能抓住用户。", prompt: "请基于当前文案做开头钩子质检：判断前三秒是否有注意力机制、是否啰嗦、是否有冲突或代入感，并给最小修改建议。", agentId: "content_review" },
  { id: "structure_review", label: "内容结构质检", description: "检查推进逻辑和信息密度。", prompt: "请基于当前文案做内容结构质检：检查开头、转折、论证、案例、收尾是否顺畅，只给需要改的地方和最小改法。", agentId: "content_review" },
  { id: "persona_review", label: "人设一致性质检", description: "检查表达是否像这个账号会说的话。", prompt: "请基于当前文案做人设一致性质检：判断语气、身份、案例和价值观是否符合账号人设，并给最小修改建议。", agentId: "content_review" },
  { id: "platform_review", label: "平台适配质检", description: "检查是否适合抖音/小红书/公众号等平台。", prompt: "请基于当前文案做平台适配质检：判断它更适合抖音、小红书、公众号还是朋友圈，并指出发布前需要调整的结构和表达。", agentId: "content_review" },
  { id: "conversion_review", label: "转化路径质检", description: "检查是否有自然承接动作。", prompt: "请基于当前文案做转化路径质检：检查目标用户、需求承接、信任理由和行动引导是否清楚，只给自然不硬广的最小改法。", agentId: "content_review" },
  { id: "risk_review", label: "风险表达质检", description: "检查违规、限流和 AI 标注提醒。", prompt: "请基于当前文案做风险表达质检：检查违规/限流风险、夸大承诺、绝对化用语、平台敏感表达和 AI 标注提醒，并给最小替换建议。", agentId: "content_review" },
]

const DEEP_COPYWRITER_SKILLS: AimWorkbenchSkill[] = [
  { id: "long_outline", label: "搭长文框架", description: "先定观点、读者和正文结构。", prompt: "请基于当前素材先搭一版长文框架，包含核心观点、目标读者、开头方向和正文推进结构。", agentId: "deep_copywriter" },
  { id: "long_article", label: "生成深度长文", description: "写成公众号文章或完整长文。", prompt: "请基于当前素材生成一篇有框架、有观点、有真人表达的公众号文章或深度长文。", agentId: "deep_copywriter" },
]

const BUSINESS_SYSTEM_SKILLS: AimWorkbenchSkill[] = [
  { id: "business_bottleneck", label: "诊断业务卡点", description: "找流量、成交、交付中的核心矛盾。", prompt: "请基于当前业务信息诊断核心卡点，找出流量、成交、交付中的主要矛盾，并给本周最小动作。", agentId: "business_system_diagnosis" },
  { id: "content_pillar_from_business", label: "反推内容主线", description: "从商业目标倒推内容方向。", prompt: "请基于当前商业模式，反推出最值得优先做的内容主线和选题方向。", agentId: "business_system_diagnosis" },
]

const PERSONA_SKILLS: AimWorkbenchSkill[] = [
  { id: "story_gap", label: "追问来时路", description: "补齐人设故事关键缺口。", prompt: "请基于当前信息，只追问一个最关键的人设故事缺口，并给回答示例。", agentId: "persona" },
  { id: "pinned_story_video", label: "生成置顶视频", description: "把人设故事写成置顶口播。", prompt: "请基于当前人设故事，生成一条置顶视频口播脚本。", agentId: "persona" },
]

export const AIM_AGENT_GUIDES: Record<AimAgentId, AimAgentGuide> = {
  content_producer: {
    intro: "这里是内容文案创作。把选题、爆款拆解、老板口述、长文或现有稿子丢进来，我会改写、再创作，并拆成适合发布的多平台内容。",
    placeholder: "粘贴选题、原始想法、老板口述、现有文案或爆款拆解，我来生成可发布内容…",
    defaultInstruction: "去 AI 味，保留真人表达的犹豫、判断和具体细节，少用套话。先判断用户要的是改写、对标再创作、追热点、获客文案、观点表达还是核心内容一键拆解，再输出适合发布的内容交付物。",
    quickPrompts: [
      "改写这版现有文案，保留我的意思，但更像真人表达。",
      "按这个爆款结构再创作一版，不照抄原句。",
      "追这个热点写一版适合我账号的内容。",
      "围绕这个客户问题生成一版获客文案。",
      "把这个观点写成一条短视频口播。",
      "把这篇深度内容拆成公众号、短视频、小红书、朋友圈和后续 12 条选题。",
    ],
    primaryActionLabel: "生成内容",
    scenarios: ["改写现有文案", "对标爆款再创作", "多平台内容拆解", "12 条发布选题"],
    inputTemplate: BASIC_INPUT_TEMPLATE,
    outputAssets: ["短视频口播", "小红书图文笔记", "公众号文章/深度长文", "朋友圈文案", "Vlog 分镜脚本", "12 条发布计划"],
    skills: CONTENT_PRODUCER_SKILLS,
    copyVariants: AIM_COPY_VARIANTS,
    nextActions: [
      { id: "publish_package", label: "生成发布计划", prompt: PUBLISH_PLAN_PROMPT },
      { id: "publish_check", label: "发布前自查", prompt: "请对下面成稿做抖音发布前自查，只给风险、最小改法和复检建议。" },
      { id: "to_deep_copywriter", label: "带入深度长文创作", targetAgentId: "deep_copywriter", prompt: "请把下面成稿扩展成一篇有框架、有观点、有真人表达的公众号文章或深度长文。" },
      { id: "save_knowledge", label: "保存为档案素材", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  deep_copywriter: {
    intro: "这里是深度长文创作。把想法、视频原文、老板口述或对标文案给我，我先搭框架，再写成公众号文章或完整深度长文。",
    placeholder: "粘贴想法、视频原文、老板口述、对标文案或想借势的热点，我先帮你搭长文框架…",
    defaultInstruction: "只做长篇文案创作。先输出文案框架，包含核心观点、目标读者、情绪入口、正文推进结构、开头方向；再用2-3个半开放选择题挖出用户真实观点。每题选项必须按 A. / B. / C. / D. 独立成行输出，方便用户点击。用户确认框架后，只输出一篇完整长文正文，正文结束立刻停止；不输出拆分方向、私域话术、任何平台分发内容或“你看是否符合”这类确认尾句。热点只能自然融合，禁止硬蹭或编造。",
    quickPrompts: [
      "根据这段视频原文，先搭长文框架，再打磨成适合我表达的公众号文章。",
      "我有一个观点，先帮我挖出真实态度，再写成开头有力量、结构完整的深度长文。",
    ],
    primaryActionLabel: "生成长篇文案",
    scenarios: ["公众号文章", "深度长文", "观点表达", "长内容再创作"],
    inputTemplate: BASIC_INPUT_TEMPLATE,
    outputAssets: ["长文框架", "公众号文章", "深度长文", "观点确认问题"],
    skills: DEEP_COPYWRITER_SKILLS,
    nextActions: [
      { id: "to_content_producer", label: "带入内容文案创作", targetAgentId: "content_producer", prompt: "请把下面长文拆成短视频口播、小红书图文笔记、朋友圈文案、Vlog 分镜脚本和后续 12 条发布选题。" },
      { id: "publish_package", label: "生成发布计划", prompt: PUBLISH_PLAN_PROMPT },
      { id: "save_knowledge", label: "保存为档案素材", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  business_diagnosis: {
    intro: "这里是灵感选题策划。先选对标账号/对标内容，再选择内容主线，生成选题池，筛出高潜选题，确定核心内容方向。",
    placeholder: "说说你的目标人群、业务方向、对标账号、爆款内容或想做的内容主线…",
    defaultInstruction: "按灵感选题策划输出：先对齐整体 IP 操作方案/客户项目全案（目标客户、主产品/服务、成交路径、交付目标、账号定位），再判断本次选题要参考哪类知识库资料，识别对标账号/对标内容，围绕热点类、人设类、问题解答类、观点类四类内容主线生成选题池，筛选高潜选题，并确定核心内容方向。不同选题要匹配不同资料：问题解答类优先客户痛点/问答/会议纪要，转化类优先产品卖点/案例/成交记录，人设类优先老板经历/定位素材，热点类优先行业信源/对标动态。会议纪要、热点、对标、问卷和采访清单只是素材来源，用来补充钩子、证据、真实问题和执行动作，不能覆盖 IP 操作方案基准线。只有用户明确要求基于会议纪要，或本次选题素材选中了会议纪要时，才从会议里的真实问题、原话、分歧、案例和下一步动作提炼选题。热点只作为行业线索，必须结合当前账号资料、对标账号、对标文案和资料库内容推荐；缺少依据时标注待补充。",
    quickPrompts: [
      "基于这份会议纪要，只提炼一个最值得马上写文案的核心选题。",
      "基于这份会议纪要，整理成选题池、任务清单、采访问题和拍摄执行清单。",
      "围绕这个目标人群，按热点类、人设类、问题解答类、观点类生成一组选题池。",
      "参考这个对标账号，帮我筛出 12 条高潜选题。",
      "基于这篇爆款内容，拆出适合我账号的核心内容方向。",
    ],
    primaryActionLabel: "生成选题策划",
    scenarios: ["选择对标账号/内容", "选择内容主线", "生成选题池", "筛选高潜选题"],
    inputTemplate: BASIC_INPUT_TEMPLATE,
    outputAssets: ["热点类选题", "人设类选题", "问题解答类选题", "观点类选题", "高潜选题"],
    skills: TOPIC_PLANNING_SKILLS,
    nextActions: [
      { id: "to_content_producer", label: "带入内容文案创作", targetAgentId: "content_producer", prompt: "请基于下面灵感选题策划，先选择一个高潜选题，生成短视频口播，并给出小红书图文、朋友圈文案和后续 12 条发布选题。" },
      { id: "save_knowledge", label: "保存为档案素材", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  business_system_diagnosis: {
    intro: "这里是商业模式诊断。它不是日常高频创作入口，而是当定位、流量、成交或交付卡住时，用来校准商业模式和 IP 定位。",
    placeholder: "说说你的业务、目前数据、卡在哪、想达到什么结果…",
    defaultInstruction: "按商业模式诊断结构输出：业务现状说明、模糊概念澄清、生意系统四层诊断、核心矛盾判断、行业参照校验、多视角复核、三条调整路径、本周最小动作。",
    quickPrompts: [
      "老板 IP 做了三个月没成交，帮我诊断问题。",
      "工程服务账号有播放但没客户，帮我找核心矛盾。",
      "我有产品但不知道怎么获客和成交，帮我做生意体检。",
    ],
    primaryActionLabel: "生成诊断报告",
    scenarios: ["业务卡住了", "流量和成交不匹配", "需要先找核心矛盾"],
    inputTemplate: BASIC_INPUT_TEMPLATE,
    outputAssets: ["商业诊断报告", "核心矛盾", "调整路径", "本周动作"],
    skills: BUSINESS_SYSTEM_SKILLS,
    nextActions: [
      { id: "to_business_diagnosis", label: "带入灵感选题策划", targetAgentId: "business_diagnosis", prompt: "请基于下面商业诊断结果，生成一份《天命IP资产化操盘全案》，走天命IP资产化操盘全案路由（12 模块）：项目总判断、天命底盘、IP主定位、目标客户、核心问题、IP价值、产品设计、内容系统、流量闭环、私域成交、交付资产化、行动处方。天命底盘没有命理资料时写「未提供/待补充」，不编造。每个模块要能指导后续选题、文案、产品承接、私域成交和交付资产化。" },
      { id: "save_knowledge", label: "保存为档案素材", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  content_review: {
    intro: "这里是发布前质检。把准备发布的文案贴给我，我会检查标题、开头钩子、内容结构、人设一致性、平台适配、转化路径和风险表达。",
    placeholder: "贴一版准备发布的口播、脚本或正文，我帮你做发布前自查…",
    defaultInstruction: "按发布前质检结构输出：总体结论、标题质检、开头钩子质检、内容结构质检、人设一致性质检、平台适配质检、转化路径质检、风险表达质检、最小修改建议、复检清单。只给最小改法，不要整篇重写。",
    quickPrompts: [
      "帮我检查这版口播能不能直接发，哪些地方必须改。",
      "帮我做抖音发布前自查，只给最小修改建议。",
    ],
    primaryActionLabel: "生成质检报告",
    scenarios: ["文案准备发布", "担心违规或限流", "只想要最小修改建议"],
    inputTemplate: [{ label: "待质检文案", placeholder: "粘贴完整口播、脚本或正文" }],
    outputAssets: ["发布前质检报告", "标题/钩子/结构检查", "平台风险", "最小改法", "复检清单"],
    skills: REVIEW_SKILLS,
    nextActions: [
      { id: "recheck", label: "复检修改稿", prompt: "请对下面修改稿做复检，只指出仍需修改的位置和原因。" },
      { id: "save_knowledge", label: "保存质检报告", prompt: "保存为 AIM 档案素材。" },
    ],
  },
  persona: {
    intro: "这里是人设故事梳理。它服务于内容主线里的「人设故事」，一步步梳理来时路，最后产出置顶视频脚本。",
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
    skills: PERSONA_SKILLS,
    nextActions: [
      { id: "to_content_producer", label: "带入内容文案创作", targetAgentId: "content_producer", prompt: "请基于下面人设故事，生成一条置顶视频口播文案，并给出小红书图文笔记、朋友圈文案和后续 12 条人设故事选题。" },
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
