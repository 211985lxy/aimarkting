import { NextResponse } from "next/server"
import { withUserAuth } from "@/lib/user-auth"
import { LLMClient } from "@/lib/llm/client"

const PROFILE_FIELDS = [
  { key: "displayName", label: "IP 名称", example: "老张说餐饮" },
  { key: "nickname", label: "昵称 / 常用称呼", example: "张哥" },
  { key: "industry", label: "行业", example: "餐饮加盟 / 教培 / 房产" },
  { key: "toneOfVoice", label: "表达口吻", example: "直给、有判断、像朋友聊天" },
  { key: "primaryOffer", label: "主打内容 / 主要卖什么", example: "一句话讲清楚你最想卖什么、解决什么问题" },
  { key: "targetAudience", label: "目标受众", example: "想做抖音获客但不会拍视频的中小老板" },
  { key: "ipTraits", label: "IP 特征 / 人设标签", example: "敢说真话、经验老到、不绕弯子、有案例" },
  { key: "proofPoints", label: "可信背书 / 证明点", example: "服务过多少客户、做了多少年、拿到什么结果" },
  { key: "callToAction", label: "行动号召", example: '评论区留言"方案"或私信我领取模板' },
]

export const POST = withUserAuth(async (request) => {
  const body = await request.json()
  const userInput = typeof body.userInput === "string" ? body.userInput.trim() : ""

  if (!userInput) {
    return NextResponse.json(
      { error: "请输入一段描述" },
      { status: 400 },
    )
  }

  const fieldDescriptions = PROFILE_FIELDS.map(
    (f) => `- "${f.key}": ${f.label}，示例：${f.example}`,
  ).join("\n")

  const systemPrompt = `你是一个个人 IP 定位专家。用户会用一句话简单描述自己的业务，你需要据此推测并填写完整的个人 IP 档案。

需要填写的字段：
${fieldDescriptions}

规则：
1. 根据用户的描述，合理推测每个字段的值
2. displayName 应该是一个适合做个人 IP 的名字，格式如"老X说XX"或"XX哥/姐"
3. nickname 从 displayName 中提取，更口语化
4. 文案要简洁有力，接地气，符合短视频个人 IP 风格
5. toneOfVoice 要体现人格化特征，不要泛泛而谈
6. ipTraits 要具体、有辨识度
7. callToAction 要有明确的下一步动作引导
8. 必须返回 JSON 格式，key 为字段 key，value 为填写的内容
9. 只返回 JSON，不要任何其他内容`

  const userPrompt = `用户描述了自己的业务：\n\n"${userInput}"\n\n请据此填写完整的个人 IP 档案。`

  const llm = LLMClient.shared()
  if (!llm.available) {
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 503 },
    )
  }

  try {
    const result = await llm.complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 1024,
      responseFormat: { type: "json_object" },
    })

    const filledFields: Record<string, string> = {}
    try {
      // LLM may wrap JSON in markdown code blocks — strip them before parsing
      let raw = result.content.trim()
      const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
      if (fenced) raw = fenced[1].trim()

      const parsed = JSON.parse(raw)
      const validKeys = new Set(PROFILE_FIELDS.map((f) => f.key))

      // Support both flat { key: value } and nested { someWrapper: { key: value } }
      const candidates =
        typeof parsed === "object" && parsed !== null ? parsed : {}
      const entries = Object.entries(candidates)
      if (
        entries.length === 1 &&
        typeof entries[0][1] === "object" &&
        entries[0][1] !== null &&
        !validKeys.has(entries[0][0])
      ) {
        // Nested wrapper — unwrap
        for (const [key, value] of Object.entries(
          entries[0][1] as Record<string, unknown>,
        )) {
          if (validKeys.has(key) && typeof value === "string" && value.trim()) {
            filledFields[key] = value.trim()
          }
        }
      } else {
        for (const [key, value] of entries) {
          if (validKeys.has(key) && typeof value === "string" && value.trim()) {
            filledFields[key] = value.trim()
          }
        }
      }
    } catch {
      console.error("[ai-fill-ip-profile] Failed to parse LLM output:", result.content)
      return NextResponse.json(
        { error: "AI response parsing failed" },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: { filledFields } })
  } catch (e) {
    console.error("[ai-fill-ip-profile] LLM error:", e)
    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 500 },
    )
  }
})
