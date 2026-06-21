import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { ensureKnowledgeEmbedding } from "@/lib/llm/embeddings"

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const url = new URL(request.url)
    const category = url.searchParams.get("category")
    const status = url.searchParams.get("status") || "active"
    const projectId = url.searchParams.get("projectId")

    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        userId: user.id,
        status,
        ...(category ? { category } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    })

    return NextResponse.json(entries)
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json(
      { error: "知识库读取失败" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()
    const { category, title, content, tags, sourceType, projectId } = body
    const requiresProject = new Set([
      "daily_inspiration",
      "benchmark_reference",
      "user_insight",
      "hot_topic",
      "positioning_material",
      "private_domain_material",
    ])

    if (!category || !title || !content) {
      return NextResponse.json(
        { error: "category, title, content 必填" },
        { status: 400 }
      )
    }

    if (requiresProject.has(category) && (!projectId || typeof projectId !== "string")) {
      return NextResponse.json(
        { error: "projectId 必填" },
        { status: 400 }
      )
    }

    if (projectId) {
      const project = await prisma.clientProject.findFirst({
        where: { id: projectId, userId: user.id, status: "active" },
        select: { id: true },
      })

      if (!project) {
        return NextResponse.json(
          { error: "IP营销全案不存在或已归档" },
          { status: 404 }
        )
      }
    }

    const entry = await prisma.knowledgeEntry.create({
      data: {
        userId: user.id,
        projectId: projectId || null,
        category,
        title,
        content,
        tags: Array.isArray(tags) ? tags : [],
        sourceType: sourceType || "manual",
      },
    })

    // Fire-and-forget: generate embedding for the new entry
    ensureKnowledgeEmbedding(entry.id).catch(() => {})

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json(
      { error: "知识创建失败" },
      { status: 500 }
    )
  }
}
