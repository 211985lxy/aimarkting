"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Link2, Video, CalendarDays } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useAuthStore } from "@/lib/store"
import { getCurrentUser } from "@/lib/api/client"
import { getSubscriptionStatus } from "@/lib/subscription"
import type { ApiUser } from "@/types/api"

/* ── Page ────────────────────────────────────────────────── */

export default function AccountPage() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null)

  useEffect(() => {
    getCurrentUser().then(setCurrentUser)
  }, [])

  const displayEmail = user?.email ?? currentUser?.email ?? ""
  const displayCreatedAt = user?.createdAt ?? currentUser?.createdAt
  const expiresAt = user?.expiresAt
  const subscriptionStatus = getSubscriptionStatus(expiresAt ?? null)
  const dailyLimit = currentUser?.dailyLimit ?? user?.dailyLimit ?? 2
  const videosCreatedToday =
    currentUser?.videosCreatedToday ?? user?.videosCreatedToday ?? 0
  const remaining = Math.max(dailyLimit - videosCreatedToday, 0)
  const remainingPercent = dailyLimit > 0 ? (remaining / dailyLimit) * 100 : 0

  function handleLogout() {
    logout()
    router.push("/login")
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  function formatExpiryLabel() {
    if (subscriptionStatus === "inactive") return "未激活"
    if (subscriptionStatus === "expired") {
      return expiresAt ? `已过期（${formatDate(expiresAt)}）` : "已过期"
    }
    if (expiresAt) return formatDate(expiresAt)
    return "—"
  }

  return (
    <div className="space-y-8">
      <PageHeader title="账户设置" />

      {/* Section 1 — 账号信息 */}
      <Card>
        <CardHeader>
          <CardTitle>账号信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between min-w-0">
            <div className="text-sm min-w-0">
              <span className="text-muted-foreground">邮箱: </span>
              <span className="font-medium break-all">{displayEmail}</span>
            </div>
          </div>
          {displayCreatedAt && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">注册时间: </span>
                  <span className="font-medium">
                    {formatDate(displayCreatedAt)}
                  </span>
                </div>
              </div>
            </>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">服务到期时间: </span>
              <span className="font-medium">{formatExpiryLabel()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — 使用额度 */}
      <Card>
        <CardHeader>
          <CardTitle>使用额度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">今日剩余生成次数</span>
              <span className="font-medium">
                {remaining} / {dailyLimit} 次
              </span>
            </div>
            <Progress value={remainingPercent} />
          </div>
          {remaining === 0 ? (
            <p className="text-sm text-orange-500 font-medium">今日已用完</p>
          ) : (
            <p className="text-sm text-muted-foreground">每日零点自动刷新</p>
          )}
        </CardContent>
      </Card>

      {/* Section 3 — 外部账号 */}
      <Card>
        <CardHeader>
          <CardTitle>外部账号绑定</CardTitle>
          <CardDescription>账号绑定功能即将上线</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">视频号</span>
            </div>
            <Badge variant="secondary" className="text-muted-foreground">
              Coming Soon
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">小红书</span>
            </div>
            <Badge variant="secondary" className="text-muted-foreground">
              Coming Soon
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 — 退出登录 */}
      <Card>
        <CardHeader>
          <CardTitle>退出登录</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="cursor-pointer"
          >
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
