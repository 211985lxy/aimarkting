"use client"

import React from "react"
import Link from "next/link"
import {
  Users,
  Video,
  KeyRound,
  FileText,
  ArrowRight,
  TrendingUp,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getStoredAdminToken } from "@/lib/admin-store"
import { getAdminUserStats, getActivationCodeStats, type UserStats, type CodeStats } from "@/lib/api/admin-client"

interface DashboardData {
  totalUsers: number
  videosToday: number
  activeTemplates: number
  hotListHealth: {
    successLast24h: number
    failedLast24h: number
  }
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = React.useState<DashboardData | null>(null)
  const [userStats, setUserStats] = React.useState<UserStats | null>(null)
  const [codeStats, setCodeStats] = React.useState<CodeStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const token = getStoredAdminToken()

    Promise.all([
      fetch("/api/admin/dashboard", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((r) => setDashboard(r?.data ?? null))
        .catch(() => null),
      getAdminUserStats()
        .then((r) => setUserStats(r.data))
        .catch(() => null),
      getActivationCodeStats()
        .then((r) => setCodeStats(r.data))
        .catch(() => null),
    ]).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="用户总数"
          value={dashboard?.totalUsers}
          icon={<Users className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <MetricCard
          title="今日视频"
          value={dashboard?.videosToday}
          icon={<Video className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <MetricCard
          title="活跃模板"
          value={dashboard?.activeTemplates}
          icon={<FileText className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <MetricCard
          title="激活码"
          value={codeStats?.total}
          subtitle={codeStats ? `${codeStats.unused} 未使用` : undefined}
          icon={<KeyRound className="h-5 w-5 text-primary" />}
          loading={loading}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">用户概览</CardTitle>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="cursor-pointer">
                查看全部 <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading || !userStats ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">本周新增</span>
                  <span className="font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    {userStats.newThisWeek}
                  </span>
                </div>
                {userStats.byPlan.map((p) => (
                  <div key={p.plan} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground capitalize">{{ free: "免费", basic: "基础", pro: "专业" }[p.plan] || p.plan} 套餐</span>
                    <span className="font-medium">{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activation Code Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">激活码</CardTitle>
            <Link href="/admin/activation-codes">
              <Button variant="ghost" size="sm" className="cursor-pointer">
                查看全部 <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading || !codeStats ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">总码数</span>
                  <span className="font-medium">{codeStats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">未使用</span>
                  <span className="font-medium">{codeStats.unused}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">已使用</span>
                  <span className="font-medium">{codeStats.used}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">使用率</span>
                  <span className="font-medium">{codeStats.usageRate}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">系统状态</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !dashboard ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">热榜抓取 (24h)</span>
                  <span className="font-medium text-green-600">
                    {dashboard.hotListHealth.successLast24h} 成功
                  </span>
                </div>
                {dashboard.hotListHealth.failedLast24h > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">失败抓取 (24h)</span>
                    <span className="font-medium text-red-600">
                      {dashboard.hotListHealth.failedLast24h}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/activation-codes" className="block">
              <Button variant="outline" className="w-full justify-start cursor-pointer">
                <KeyRound className="h-4 w-4 mr-2" />
                生成激活码
              </Button>
            </Link>
            <Link href="/admin/users" className="block">
              <Button variant="outline" className="w-full justify-start cursor-pointer">
                <Users className="h-4 w-4 mr-2" />
                管理用户
              </Button>
            </Link>
            <Link href="/admin/settings" className="block">
              <Button variant="outline" className="w-full justify-start cursor-pointer">
                <FileText className="h-4 w-4 mr-2" />
                系统设置
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  loading,
}: {
  title: string
  value: number | undefined
  subtitle?: string
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-12 mt-1" />
          ) : (
            <>
              <p className="text-2xl font-bold">{value?.toLocaleString() ?? 0}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
