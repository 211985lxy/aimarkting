import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

// GET — 知识库统计（总条目数、分类分布、用户分布等）
export const GET = withAdminAuth(async () => {
  const [totalEntries, categoryDistribution, sourceTypeDistribution, topUsers] =
    await Promise.all([
      prisma.knowledgeEntry.count(),
      prisma.knowledgeEntry.groupBy({
        by: ["category"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.knowledgeEntry.groupBy({
        by: ["sourceType"],
        _count: { id: true },
      }),
      prisma.knowledgeEntry.groupBy({
        by: ["userId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
    ])

  // 获取 top 用户的信息
  const userIds = topUsers.map((u) => u.userId)
  const userMap: Record<string, { name: string; email: string }> = {}
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })
    for (const u of users) {
      userMap[u.id] = { name: u.name, email: u.email }
    }
  }

  return NextResponse.json({
    data: {
      totalEntries,
      categoryDistribution: categoryDistribution.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      sourceTypeDistribution: sourceTypeDistribution.map((s) => ({
        sourceType: s.sourceType,
        count: s._count.id,
      })),
      topUsers: topUsers.map((u) => ({
        userId: u.userId,
        count: u._count.id,
        user: userMap[u.userId] ?? null,
      })),
    },
  })
})
