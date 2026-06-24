import { NextRequest, NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export const GET = withAdminAuth(async (request: NextRequest) => {
  const url = new URL(request.url)
  const status = url.searchParams.get("status") || "active,paused"
  const statuses = status
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item === "active" || item === "paused" || item === "archived")

  const projects = await prisma.clientProject.findMany({
    where: statuses.length ? { status: { in: statuses } } : {},
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      companyName: true,
      industry: true,
      status: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  })

  return NextResponse.json({ data: projects })
})
