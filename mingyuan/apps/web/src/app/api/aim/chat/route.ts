import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { prisma } from "@/lib/prisma"
import { buildAimChatResponse } from "@/lib/aim-agent-handlers"
import { handleLarkToolAction, buildKnowledgeBlock } from "@/lib/aim-tool-actions"

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

    // ── 飞书工具动作（委托给共享模块）──
    if (toolAction) {
      if (!projectId) {
        return NextResponse.json({ error: "请先选择 IP 营销全案" }, { status: 400 })
      }
      const result = await handleLarkToolAction(toolAction, { userId: user.id, projectId, resultId })
      return NextResponse.json(result)
    }

    // ── 普通聊天 ──
    const knowledge = await prisma.knowledgeEntry.findMany({
      where: {
        userId: user.id,
        status: "active",
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { sortOrder: "asc" },
      take: 50,
    })

    const knowledgeBlock = buildKnowledgeBlock(knowledge)

    const chatResponse = await buildAimChatResponse(agentId, {
      userId: user.id,
      projectId: projectId || undefined,
      messages,
      knowledgeBlock,
    })

    return NextResponse.json({
      content: chatResponse.content,
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
