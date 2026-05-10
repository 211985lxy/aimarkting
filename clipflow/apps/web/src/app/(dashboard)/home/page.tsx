"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Video, Sparkles, Flame, UserCircle, X } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser, listHotTopics, listVideoTasks } from "@/lib/api/client"
import { useAuthStore } from "@/lib/store"
import { getIpProfile } from "@/lib/api/client"
import type { ApiUser, ApiVideoTask } from "@/types/api"
import type { HotTopic } from "@/types/content-template"

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  completed: {
    label: "已完成",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  processing: {
    label: "生成中",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  pending: {
    label: "排队中",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  failed: {
    label: "失败",
    className: "bg-red-100 text-red-700 border-red-200",
  },
}

const marketingTips = [
  "个人 IP 打造秘诀：保持固定的数字人形象，让观众快速记住你。",
  "短视频黄金前 3 秒：开场直接抛出痛点问题，留住观众。",
  "发布频率建议：每天 1-2 条短视频，持续输出建立信任感。",
  "内容结构公式：痛点 → 方案 → 行动号召，转化率提升 40%。",
  "数据复盘技巧：关注完播率而非播放量，完播率高的内容值得翻拍。",
  "评论区运营：主动回复前 10 条评论，算法会给更多推荐流量。",
  "发布时间建议：工作日 12:00-13:00 和 20:00-22:00 是流量高峰。",
]

function getGreetingByTime(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) {
    return "早上好！数据显示早晨发布的短视频互动率高出 23%，现在正是创作的好时机。"
  }
  if (hour >= 12 && hour < 18) {
    return "下午好！建议下午录制的视频配合晚间发布，触达更多潜在客户。"
  }
  return "晚上好！晚间是用户刷视频的高峰期，准备好明天的内容了吗？"
}

function getTipOfTheDay(): string {
  const dayIndex = Math.floor(Date.now() / 86400000) % marketingTips.length
  return marketingTips[dayIndex]
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [videoTasks, setVideoTasks] = useState<ApiVideoTask[]>([])
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [hotItems, setHotItems] = useState<HotTopic[]>([])
  const [hotLoading, setHotLoading] = useState(true)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [tasks, userData] = await Promise.all([listVideoTasks(), getCurrentUser()])
        setVideoTasks(tasks)
        setCurrentUser(userData)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    listHotTopics()
      .then((data) => setHotItems(data.topics))
      .finally(() => setHotLoading(false))

    // Check IP profile completion
    getIpProfile()
      .then((profile) => {
        if (!profile.isComplete) {
          setShowProfileModal(true)
        } else if ((profile.profile?.profileVersion ?? 1) === 1) {
          // v1 complete user — show non-blocking upgrade banner
          setShowUpgradeBanner(true)
        }
        // v2 complete users: neither modal nor banner
      })
      .catch(() => {
        setShowProfileModal(true)
      })
  }, [])

  const completedCount = videoTasks.filter(
    (t) => t.status === "completed"
  ).length

  const displayName = user?.name || currentUser?.name || "用户"
  const dailyLimit = currentUser?.dailyLimit ?? user?.dailyLimit ?? 2
  const videosCreatedToday =
    currentUser?.videosCreatedToday ?? user?.videosCreatedToday ?? 0
  const remaining = Math.max(dailyLimit - videosCreatedToday, 0)
  const limitReached = remaining === 0

  const recentTasks = videoTasks.slice(0, 6)

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-8">
      {/* IP Profile completion modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              完善个人 IP 档案
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              你的 IP 档案还没有完善。填写行业、主打内容和人设标签后，AI 才能为你生成高质量的营销文案。
            </p>
            <p className="text-sm text-muted-foreground">
              只需 2 分钟，让系统更懂你的业务。
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowProfileModal(false)}
                className="cursor-pointer"
              >
                稍后再说
              </Button>
              <Button
                onClick={() => router.push("/ip-profile")}
                className="cursor-pointer"
              >
                去完善档案
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* v1 complete user upgrade nudge */}
      {showUpgradeBanner && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm">
                解锁 AI 三维定位 — 升级你的 IP 档案，获取更精准的内容策略
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="link"
                size="sm"
                className="cursor-pointer"
                onClick={() => router.push("/ip-profile")}
              >
                了解更多
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                aria-label="关闭升级提示"
                onClick={() => setShowUpgradeBanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <PageHeader
        title={`欢迎回来，${displayName}`}
        subtitle={getGreetingByTime()}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Daily Quota Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              今日可生成
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {limitReached ? (
                <span className="text-orange-500">
                  {remaining}/{dailyLimit} 次
                </span>
              ) : (
                <span>
                  {remaining}/{dailyLimit} 次
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {limitReached ? "明日刷新" : "每日重置"}
            </p>
          </CardContent>
        </Card>

        {/* Completed Videos Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              累计视频
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              已完成的视频
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create Video CTA */}
      {limitReached ? (
        <Card className="bg-muted border-dashed">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted-foreground/10">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-muted-foreground">
                开始创建营销视频
              </h2>
              <p className="text-sm text-muted-foreground">
                今日生成次数已用完，明天再来
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Link href="/create" className="block cursor-pointer">
          <Card className="bg-primary text-primary-foreground transition-opacity duration-200 hover:opacity-90">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">开始创建营销视频</h2>
                <p className="text-sm opacity-80">
                  只需三步：输入文案 → 选择数字人 →
                  自动生成。像拥有一个专属视频团队。
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Marketing Tips Card */}
      <Card className="bg-muted/50">
        <CardContent className="flex items-start gap-3 py-5">
          <Sparkles className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold mb-1">营销小贴士</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getTipOfTheDay()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 抖音热榜 */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Flame className="h-5 w-5 text-orange-500 shrink-0" />
          <CardTitle className="text-base">抖音热榜</CardTitle>
          <Badge variant="secondary" className="text-xs">实时热点</Badge>
          <span className="ml-auto text-xs text-muted-foreground">追热点创作</span>
        </CardHeader>
        <CardContent>
          {hotLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : hotItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">暂无热榜数据</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto -mr-2 pr-2">
              <ul className="space-y-1">
                {hotItems.slice(0, 10).map((item, idx) => {
                  const rank = idx + 1
                  const isTop3 = rank <= 3
                  const hotDisplay = item.hotValue >= 10000
                    ? `${Math.floor(item.hotValue / 10000)}万`
                    : String(item.hotValue)
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 py-1.5 text-sm"
                    >
                      <span
                        className={`w-5 text-center font-mono text-xs shrink-0 ${
                          isTop3 ? "text-primary font-bold" : "text-muted-foreground"
                        }`}
                      >
                        {rank}
                      </span>
                      <span className="flex-1 truncate min-w-0">{item.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                        {hotDisplay}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs shrink-0"
                        onClick={() =>
                          router.push(
                            `/create?hotTopicId=${encodeURIComponent(item.id)}&hotTopic=${encodeURIComponent(item.title)}`
                          )
                        }
                      >
                        追热点
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Videos */}
      <div>
        <h2 className="text-lg font-bold mb-4">最近视频</h2>

        {recentTasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Video className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                还没有视频，开始创建吧！
              </p>
              {!limitReached && (
                <Link
                  href="/create"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  创建视频
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentTasks.map((task) => {
              const status = statusConfig[task.status] ?? statusConfig.pending
              return (
                <Card
                  key={task.id}
                  className="cursor-pointer transition-colors duration-200 hover:bg-muted/50 overflow-hidden group"
                  onClick={() => router.push(`/videos/${task.id}`)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[3/4] bg-muted overflow-hidden">
                    {task.coverUrl ? (
                      <Image
                        src={task.coverUrl}
                        alt={`视频 ${task.avatarName}`}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <Badge
                      className={`absolute top-2 right-2 border text-xs ${status.className}`}
                    >
                      {status.label}
                    </Badge>
                  </div>

                  <CardContent className="pt-3 space-y-1.5">
                    <p className="text-sm line-clamp-2 leading-relaxed">
                      {task.scriptContent}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{task.avatarName}</span>
                      <span>{formatDate(task.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-80 mt-2" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-16 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA skeleton */}
      <Skeleton className="h-24 w-full rounded-xl" />

      {/* Tips skeleton */}
      <Skeleton className="h-16 w-full rounded-xl" />

      {/* Recent videos skeleton */}
      <div>
        <Skeleton className="h-6 w-24 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[3/4] w-full" />
              <CardContent className="pt-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-1" />
                <div className="flex justify-between mt-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
