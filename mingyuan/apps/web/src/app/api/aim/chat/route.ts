import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { prisma } from "@/lib/prisma"
import { LLMClient } from "@/lib/llm/client"
import type { ChatMessage } from "@/lib/llm/types"
import { exportLarkBaseResult, importLarkBaseKnowledge, setEmbeddingHook } from "@/lib/lark-base-tool"
import { buildIpCopywritingMethodologyBlock } from "@/lib/ip-copywriting-methodology"
import { buildBusinessDiagnosisMethodologyBlock } from "@/lib/business-diagnosis-methodology"
import { ensureKnowledgeEmbedding } from "@/lib/llm/embeddings"

// Register embedding hook for lark imports through chat
setEmbeddingHook(ensureKnowledgeEmbedding)

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
    const agentId = typeof body.agentId === "string" ? body.agentId : ""
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
    const toolAction = typeof body.toolAction === "string" ? body.toolAction : ""
    const resultId = typeof body.resultId === "string" ? body.resultId.trim() : ""

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "请求格式不正确，缺少 messages 数组" }, { status: 400 })
    }

    if (toolAction) {
      if (!projectId) {
        return NextResponse.json({ error: "请先选择 IP 营销全案" }, { status: 400 })
      }

      if (toolAction === "import_lark_topics") {
        const result = await importLarkBaseKnowledge({
          userId: user.id,
          projectId,
          tableType: "topic_review",
          db: prisma,
        })
        return NextResponse.json({
          content: `已同步飞书选题：新增 ${result.created} 条，更新 ${result.updated} 条。`,
          toolResult: result,
        })
      }

      if (toolAction === "import_lark_project_data" || toolAction === "import_lark_archive_data") {
        const result = await importLarkBaseKnowledge({
          userId: user.id,
          projectId,
          tableType: toolAction === "import_lark_project_data" ? "project_management" : "data_archive",
          db: prisma,
        })
        return NextResponse.json({
          content: `已导入飞书数据：新增 ${result.created} 条，更新 ${result.updated} 条。`,
          toolResult: result,
        })
      }

      if (toolAction === "export_lark_generation") {
        if (!resultId) {
          return NextResponse.json({ error: "缺少要回写的 AIM 结果" }, { status: 400 })
        }
        await exportLarkBaseResult({
          userId: user.id,
          projectId,
          resultType: "script",
          resultId,
          db: prisma,
        })
        return NextResponse.json({ content: "已把这条 AIM 内容回写到飞书。" })
      }

      return NextResponse.json({ error: "不支持的工具动作" }, { status: 400 })
    }

    // 提取知识库
    const knowledge = await prisma.knowledgeEntry.findMany({
      where: {
        userId: user.id,
        status: "active",
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { sortOrder: "asc" },
      take: 50,
    })

    const ipSnapshot = ""
    const knowledgeBlock = buildKnowledgeBlock(knowledge)
    const methodologyBlock = await buildIpCopywritingMethodologyBlock()
    const businessDiagnosisBlock = agentId === "business_system_diagnosis"
      ? await buildBusinessDiagnosisMethodologyBlock()
      : ""

    const systemPrompt = agentId === "business_system_diagnosis"
      ? `你是一个企业商业诊断官，正在帮助用户做一次生意系统体检。

企业已有核心知识库（参考背景）：
${knowledgeBlock}

商业诊断方法论（内部判断规则）：
${businessDiagnosisBlock}

你的对话原则：
1. 先校准事实，再做判断。信息不足时，每次只追问一个最关键问题，并给出 2-4 个可选答案让用户选择。
2. 重点围绕业务类型、现状数据、真实目标、约束条件、验收标准追问。
3. 统一呈现为生意系统体检，不解释内部方法来源。
4. 如果信息已经足够，提醒用户可以点击【一键生成】生成完整诊断报告。
5. 不要让用户做开放式填空题；如果必须开放补充，把它放在选项之后，作为“也可以补充具体情况”。

请直接根据上文与用户的历史对话，产出你下一轮的建议或追问。`
      : agentId === "business_diagnosis"
        ? `你是一个定位策划官，负责帮助用户明确 IP 定位、人设定位、内容定位和初始成交路径。

企业已有核心知识库（参考背景）：
${knowledgeBlock}

你的对话原则：
1. 只处理 IP 本身：这个人如何站出来、被谁信任、讲什么内容、承接什么产品。
2. 信息不足时，每次只追问一个最关键问题，并给出 2-4 个可选答案让用户选择。
3. 不要让用户做开放式填空题；选项必须具体，例如“专家型 / 老板实战型 / 陪伴型 / 行业观察型”。
4. 如果信息已经足够，提醒用户可以点击【一键生成】生成定位方案。

请直接根据上文与用户的历史对话，产出你下一轮的建议或追问。`
        : agentId === "deep_copywriter"
          ? `你是一个深度文案官，负责把想法、视频原文、老板口述或对标文案，打磨成一篇高质量、可拆分复用的深度母稿。

企业已有核心知识库（参考背景）：
${knowledgeBlock}

IP操盘方法论（写作与判断规则）：
${methodologyBlock}

你的对话原则：
1. 先判断选题是否有情绪波动、用户痛点、表达欲和可融合热点。
2. 人设性、观点型、老板口述和对标文案改造，默认先问后写。
3. 先一次性给出 3-5 个半开放选择题挖出用户真实观点；每题给 2-4 个选项，选项必须紧跟问题并按以下格式独立成行，方便前端渲染成逐题点击流程：
A. 选项内容
B. 选项内容
C. 选项内容
4. 不要只抛开放式问题；如果需要用户补充，把“也可以补一句真实想法”放在选项之后。
5. 用户回答后，再输出观点确认、大纲、第一句话/前3秒钩子和深度母稿。
6. 如果用户一开始已经提供足够强的观点和经历，可以少问，但仍至少做一次观点确认。
7. 热点只能基于用户提供的热点、已有上下文或明确行业趋势自然融合，禁止硬蹭或编造。
8. 成稿前先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
9. 不暴露外部参考来源细节。

请直接根据上文与用户的历史对话，产出下一轮内容。`
        : agentId === "content_review"
          ? `你是一个内容复盘官，负责根据已发布内容、播放互动数据、评论反馈和转化情况，判断内容表现，并给出下一轮优化和复用方向。

企业已有核心知识库（参考背景）：
${knowledgeBlock}

你的对话原则：
1. 先判断内容表现：选题、开头、结构、表达、承接动作分别哪里有效或失效。
2. 不泛泛鼓励，不输出空话，必须给出明确判断和下一步动作。
3. 如果用户给了评论或私信，把它们提炼成新选题、复用角度或私域承接话术。
4. 如果信息不足，直接按已给信息做保守复盘，并说明还缺哪一类数据。
5. 输出优先包含：表现判断、原因、下一轮优化、可复用资产、可延展新选题。

请直接根据上文与用户的历史对话，产出下一轮内容。`
      : `你是一个身经百战的「太极营销创意总监」，正与企业老板（用户）面对面进行爆款营销文案创意碰撞与思路对齐。

你的使命：
根据用户已经给出的素材、对标文案、企业知识库和方法论，直接给出可执行的文案方向、初稿或改写建议。

企业IP定位档案：
${ipSnapshot}

企业已有核心知识库（参考背景）：
${knowledgeBlock}

IP操盘方法论（写作与判断规则）：
${methodologyBlock}

你的对话原则：
1. 文案类智能体不追问客户，不让客户补充资料，不输出追问式开场。
2. 如果信息不足，基于已有上下文做合理假设，直接给出一个可用版本。
3. 可以说明“我会先按某个方向处理”，但后面必须跟成稿、结构方案或可复制文案。
4. 绝对不要说 AI 味的官腔、客套话（如"很高兴能与您碰撞"、"这是一个非常好的切入点"等）。
5. 先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
6. 如果用户确实需要先做定位或诊断，只给一句简短建议引导去定位策划官或商业诊断官，不在内容生产官里追问。

请直接根据上文与用户的历史对话，产出下一轮内容。`

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
