import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

// GET — 查看所有用户的知识库条目（分页+搜索+过滤）
export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10)
  const search = searchParams.get("search") ?? ""
  const category = searchParams.get("category") ?? ""
  const userId = searchParams.get("userId") ?? ""
  const sourceType = searchParams.get("sourceType") ?? ""

  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (userId) where.userId = userId
  if (sourceType) where.sourceType = sourceType
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { content: { contains: search } },
    ]
  }

  const [entries, total] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.knowledgeEntry.count({ where }),
  ])

  return NextResponse.json({
    data: { results: entries, total, page, pageSize },
  })
})

// PUT — 管理员强制批量更新（批量变更状态或分类）
export const PUT = withAdminAuth(async (request) => {
  const body = await request.json()
  const { ids, action, value } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids 必填" }, { status: 400 })
  }

  if (action === "archive") {
    await prisma.knowledgeEntry.updateMany({
      where: { id: { in: ids } },
      data: { status: "archived" },
    })
  } else if (action === "activate") {
    await prisma.knowledgeEntry.updateMany({
      where: { id: { in: ids } },
      data: { status: "active" },
    })
  } else if (action === "delete") {
    await prisma.knowledgeEntry.deleteMany({
      where: { id: { in: ids } },
    })
  } else if (action === "changeCategory" && value) {
    await prisma.knowledgeEntry.updateMany({
      where: { id: { in: ids } },
      data: { category: value },
    })
  } else {
    return NextResponse.json({ error: "无效操作" }, { status: 400 })
  }

  return NextResponse.json({ success: true })
})

// DELETE — 批量删除
export const DELETE = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const ids = searchParams.get("ids")

  if (id) {
    await prisma.knowledgeEntry.delete({ where: { id } })
  } else if (ids) {
    const idList = ids.split(",")
    await prisma.knowledgeEntry.deleteMany({ where: { id: { in: idList } } })
  } else {
    return NextResponse.json({ error: "需要 id 或 ids 参数" }, { status: 400 })
  }

  return NextResponse.json({ success: true })
})
