import { NextResponse } from "next/server"
import { withUserAuth } from "@/lib/user-auth"
import { LLMClient } from "@/lib/llm"

export const maxDuration = 60

const POLISH_MODEL = process.env.SCRIPT_GENERATION_MODEL || "openai/gpt-5.4"

export const POST = withUserAuth(async (request) => {
  const body = await request.json()
  const content = typeof body.content === "string" ? body.content.trim() : ""
  const weakDimensions = Array.isArray(body.weakDimensions) ? body.weakDimensions as string[] : []
  const topicTitle = typeof body.topicTitle === "string" ? body.topicTitle : null
  const persona = typeof body.persona === "string" ? body.persona : null

  if (!content || content.length < 30) {
    return NextResponse.json({ error: "文案内容不能为空" }, { status: 400 })
  }

  const llm = LLMClient.shared()
  if (!llm.available) {
    return NextResponse.json({ error: "AI 服务暂时不可用" }, { status: 503 })
  }

  // Build targeted polish instructions based on weak dimensions
  const polishInstructions: string[] = []

  if (weakDimensions.includes("aiTaste")) {
    polishInstructions.push(
      "【AI味消除——最高优先级】",
      "1. 逐段扫描，删除或替换以下禁用词：赋能、痛点、赛道、底层逻辑、闭环、矩阵、抓手、沉淀、打法、心智、颗粒度、链路、复用、拉齐、对齐、盘活、破圈、种草、拔草、转化链路、商业闭环、价值主张、核心壁垒、差异化打法、降维打击、认知升级。",
      "2. 打破排比三连——如果有三个以上相同句式连续出现，保留最有力的一个，其余改为不同句式。",
      "3. 把'首先...其次...最后...'改为口语过渡（比如'还有一点很关键'、'最让我意外的是'）。",
      "4. '不是...而是...'如果出现超过一次，只保留最有冲击力的一次，其余改成直接陈述。",
      "5. 加入1-2处真实感细节（具体数字、场景描述、个人感受），让文案像真人说的。",
    )
  }

  if (weakDimensions.includes("editorial")) {
    polishInstructions.push(
      "【编辑质量提升】",
      "1. 检查每句话是否有信息量——删掉纯凑字数的空话和废话。",
      "2. 确保前后逻辑连贯，不要跳跃——如果两段之间缺少过渡，加一句口语化衔接。",
      "3. 检查是否有错别字、语病或不通顺的表述，直接修正。",
    )
  }

  if (weakDimensions.includes("attraction")) {
    polishInstructions.push(
      "【吸引力提升】",
      "1. 前3秒（前15个字以内）必须有钩子——反常识、具体数字、直接挑战、或引发好奇的提问。",
      "2. 如果开头是'今天我们来聊...'、'大家好我是...'这类万能开场，必须改掉。",
      "3. 在文案中间加入至少一处'意料之外'的转折或反直觉表述。",
    )
  }

  if (weakDimensions.includes("logic")) {
    polishInstructions.push(
      "【逻辑性提升】",
      "1. 检查论点→论据→结论的链条是否完整，如果缺少论据支撑，补充一个具体案例或数据。",
      "2. 如果CTA和前面的论述脱节，加一句过渡让CTA显得自然。",
      "3. 确保每段话都在推进核心论点，不要跑题。",
    )
  }

  // Default: if no weak dimensions specified, do general polish
  if (polishInstructions.length === 0) {
    polishInstructions.push(
      "【综合润色】",
      "优化文案的口语化表达、去除AI味痕迹、增强开头吸引力和逻辑连贯性。",
    )
  }

  const contextSection = [
    topicTitle ? `选题方向：${topicTitle}` : null,
    persona ? `IP人设：${persona}` : null,
  ].filter(Boolean).join("\n")

  const result = await llm.complete({
    model: POLISH_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "你是一位短视频文案润色专家。你的任务是对用户给出的口播文案进行精准润色。",
          "",
          "核心原则：",
          "- 保持原文的核心意思和信息点不变",
          "- 保持原文的整体结构和段落顺序不变",
          "- 只修改需要优化的部分，不要全量重写",
          "- 润色后的文案必须可以直接朗读，像真人在跟镜头说话",
          "- 禁止添加任何解释、注释或结构标签",
          "",
          ...polishInstructions,
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          contextSection ? `${contextSection}\n` : "",
          "请润色以下文案：\n",
          content,
          "",
          "直接输出润色后的文案纯文本，不要输出任何其他内容。",
        ].join("\n"),
      },
    ],
    temperature: 0.4,
    maxTokens: 2000,
  })

  const polished = result.content
    .replace(/^【[^】]+】\s*/g, "")
    .replace(/^润色后[：:]\s*/gi, "")
    .replace(/^修改后[：:]\s*/gi, "")
    .trim()

  if (!polished || polished.length < 30) {
    return NextResponse.json({ error: "润色结果无效，请重试" }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      original: content,
      polished,
      polishedDimensions: weakDimensions,
    },
  })
})