import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { buildAimChatResponse, buildAimChatResponseStream } from "@/lib/aim-agent-handlers"
import { handleLarkToolAction } from "@/lib/aim-tool-actions"
import { buildAimKnowledgeContext } from "@/lib/aim-knowledge-context"
import { buildAimCompetitorWatchContext } from "@/lib/aim-competitor-watch-context"
import { getStyleProfileBlock } from "@/lib/style-profile"

function streamChatContent(chunks: AsyncIterable<string>) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    },
  )
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
    const shouldStream = body.stream === true

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

    // ── 普通聊天：使用统一知识上下文 ──
    const lastMessage = messages[messages.length - 1]
    const query = typeof lastMessage?.content === "string" ? lastMessage.content.slice(0, 500) : ""

    const { knowledgeBlock: baseKnowledgeBlock } = await buildAimKnowledgeContext({
      userId: user.id,
      projectId: projectId || "<no-project>",
      agentId,
      query,
    }).catch(() => ({ knowledgeBlock: "", entries: [], source: "raw" as const }))

    // 用户级全局写作风格档案：独立检索，绕开 buildAimKnowledgeContext 的 projectId 硬过滤
    const styleBlock = await getStyleProfileBlock(user.id).catch(() => "")
    const competitorWatchBlock =
      agentId === "business_diagnosis"
        ? await buildAimCompetitorWatchContext(user.id, query).catch(() => "")
        : ""
    const knowledgeBlock = [baseKnowledgeBlock, competitorWatchBlock, styleBlock].filter(Boolean).join("\n")

    const chatParams = {
      userId: user.id,
      projectId: projectId || undefined,
      messages,
      knowledgeBlock,
    }

    if (shouldStream) {
      return streamChatContent(buildAimChatResponseStream(agentId, chatParams))
    }

    const chatResponse = await buildAimChatResponse(agentId, chatParams)

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
