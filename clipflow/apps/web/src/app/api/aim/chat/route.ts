import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { prisma } from "@/lib/prisma"
import { LLMClient } from "@/lib/llm/client"
import type { ChatMessage } from "@/lib/llm/types"

const CATEGORY_LABELS: Record<string, string> = {
  boss_experience: "老板经验",
  product_usp: "产品卖点",
  customer_pain: "客户痛点",
  project_case: "项目案例",
  customer_qa: "客户问答",
}

function buildKnowledgeBlock(
  entries: Array<{ category: string; title: string; content: string }>
): string {
  if (entries.length === 0) return ""

  const grouped = new Map<string, typeof entries>()
  for (const entry of entries) {
    const list = grouped.get(entry.category) || []
    list.push(entry)
    grouped.set(entry.category, list)
  }

  let block = "\n\n=== 企业知识库 ===\n"
  for (const [category, items] of grouped) {
    block += `\n【${CATEGORY_LABELS[category] || category}】\n`
    for (const item of items) {
      block += `- ${item.title}：${item.content}\n`
    }
  }
  return block
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()
    const messages = body.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "请求格式不正确，缺少 messages 数组" }, { status: 400 })
    }

    // 提取知识库
    const knowledge = await prisma.knowledgeEntry.findMany({
      where: { userId: user.id, status: "active" },
      orderBy: { sortOrder: "asc" },
      take: 200,
    })

    const ipSnapshot = ""
    const knowledgeBlock = buildKnowledgeBlock(knowledge)

    const systemPrompt = `你是一个身经百战的「太极营销创意总监」，正与企业老板（用户）面对面进行爆款营销文案创意碰撞与思路对齐。

你的使命：
通过 2-3 轮极具启发性、直击痛点的温和对话，帮助老板挖掘他脑海中最具差异化的【老板独家经验】、【产品核心卖点】、【客户真实痛点】和【经典项目案例】。
对齐共识后，我们将自动一键生成爆款视频脚本、公众号长文和朋友圈文案。

企业IP定位档案：
${ipSnapshot}

企业已有核心知识库（参考背景）：
${knowledgeBlock}

你的对话原则：
1. 【精简太极，温润如玉】：每次只温和地、简短地追问 **一个** 具有极大价值的商业/营销核心问题，字数控制在 100-150 字以内。
2. 【杜绝套话，单刀直入】：绝对不要说任何 AI 味的官腔、客套话（如"很高兴能与您碰撞"、"这是一个非常好的切入点"等）。直接点出要害并提出有灵感启发的追问。
3. 【引导生成】：如果对话已经进行到 2 轮以上，或者你觉得老板补充的内容已经极其充分，能够作为撰写文案的铁证时，你可以在问题后温和引导：“太棒了，我们脑海中的创意已完全对齐！现在您可以点击右下角的【一键生成】按钮，我将为您推演并炼制这组太极薪火爆款文案。”

请直接根据上文与用户的历史对话，产出你下一轮的建议或追问。`

    type IncomingMessage = { role?: string; content?: unknown }
    const incomingMessages = Array.isArray(messages) ? (messages as IncomingMessage[]) : []
    const formattedMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...incomingMessages.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m.content || "").trim(),
      })),
    ]

    const llm = LLMClient.shared()
    const completion = await llm.complete({
      messages: formattedMessages,
      temperature: 0.7,
    })

    return NextResponse.json({
      content: completion.content,
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("[aim/chat] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "对话失败，请稍后重试" },
      { status: 500 }
    )
  }
}
