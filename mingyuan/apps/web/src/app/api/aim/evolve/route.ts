import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { prisma } from "@/lib/prisma"
import {
  extractAimEvolutionSuggestions,
  normalizeEvolutionMessages,
} from "@/lib/aim-chat-evolution"

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
    const messages = normalizeEvolutionMessages(body.messages)

    if (!projectId) {
      return NextResponse.json({ error: "projectId 必填" }, { status: 400 })
    }
    if (messages.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    const project = await prisma.clientProject.findFirst({
      where: { id: projectId, userId: user.id, status: "active" },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json({ error: "IP营销全案不存在或已归档" }, { status: 404 })
    }

    const suggestions = await extractAimEvolutionSuggestions({
      messages,
      maxSuggestions: 5,
    })

    return NextResponse.json({ suggestions })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("[aim/evolve] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "偏好提炼失败" },
      { status: 500 },
    )
  }
}
