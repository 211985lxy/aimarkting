"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { BrandLogo } from "@/components/branding/brand-logo"
import { useBranding } from "@/components/providers/branding-provider"
import {
  LayoutDashboard,
  Settings,
  BriefcaseBusiness,
  Newspaper,
  BarChart2,
  Target,
  FileText,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import {
  AIM_AGENT_OPTIONS,
  DEFAULT_AIM_AGENT,
  isValidAimAgent,
  type AimAgentId,
} from "@/lib/aim-ui-config"
import { useAimWorkspaceStore } from "@/lib/aim-workspace-store"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "内容生产",
    items: [
      { title: "工作台", href: "/home", icon: LayoutDashboard },
      { title: "选题策划官", href: "/topic-planning", icon: Target },
      { title: "AI HOT 简报", href: "/ai-hot", icon: Newspaper },
      { title: "对标账号调查", href: "/competitor", icon: BarChart2 },
      { title: "文案提取分析", href: "/video-copy", icon: FileText },
      { title: "IP营销全案", href: "/projects", icon: BriefcaseBusiness },
    ],
  },
]

const footerItems: NavItem[] = [
  { title: "账户设置", href: "/account", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const branding = useBranding()
  const { setOpenMobile } = useSidebar()

  const isAim = pathname === "/aim"
  const agentParam = searchParams.get("agent")
  const activeAgent: AimAgentId = isValidAimAgent(agentParam) ? agentParam : DEFAULT_AIM_AGENT

  const history = useAimWorkspaceStore((s) => s.history)
  const fetchHistory = useAimWorkspaceStore((s) => s.fetchHistory)
  const requestLoad = useAimWorkspaceStore((s) => s.requestLoad)

  // 进入 /aim 时拉取最近生成记录
  useEffect(() => {
    if (isAim) fetchHistory().catch(() => {})
  }, [isAim, fetchHistory])

  const closeMobile = () => setOpenMobile(false)

  return (
    <Sidebar className="border-r border-border/40 bg-sidebar/95 backdrop-blur-md">
      <SidebarHeader className="p-4 border-b border-border/20">
        <Link href="/home" className="flex items-center gap-3 cursor-pointer group">
          <BrandLogo className="h-8 w-8 rounded-md transition-transform duration-500 group-hover:rotate-180" />
          <span className="text-lg font-bold tracking-wider bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
            {branding.name}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="pt-4">
        {/* 导航分组 */}
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-3 text-xs font-semibold tracking-widest text-muted-foreground/75">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        className={cn(
                          "cursor-pointer w-full transition-all duration-200 rounded-md py-2.5 px-3 flex items-center gap-3",
                          active
                            ? "bg-primary/8 text-primary font-semibold border-l-[3px] border-l-primary rounded-l-none pl-2.5"
                            : "hover:bg-secondary/40 text-foreground/80 hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm tracking-wide">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* 内容智能体：4 个入口常驻（所有页面）；「最近内容」仅 /aim 显示 */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold tracking-widest text-muted-foreground/75">
            内容智能体
          </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <div className="space-y-1 px-2">
                {AIM_AGENT_OPTIONS.map((a) => {
                  const Icon = a.icon
                  const active = isAim && a.id === activeAgent
                  return (
                    <Link
                      key={a.id}
                      href={`/aim?agent=${a.id}`}
                      onClick={closeMobile}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors",
                        active ? "bg-primary/8 ring-1 ring-primary/20" : "hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          active ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block text-sm font-medium", active ? "text-primary" : "text-foreground")}>
                          {a.title}
                        </span>
                        <span className="block text-[11px] leading-tight text-muted-foreground line-clamp-2">
                          {a.description}
                        </span>
                      </span>
                    </Link>
                  )
                })}
              </div>

              {/* 最近内容：仅 /aim 显示 */}
              {isAim && (
              <div className="mt-3 border-t pt-3">
                <p className="px-3 pb-1.5 text-xs font-semibold text-muted-foreground">最近内容</p>
                {history.length === 0 ? (
                  <p className="px-3 text-[11px] text-muted-foreground/70">还没有生成记录</p>
                ) : (
                  <div className="space-y-0.5 px-1.5">
                    {history.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          requestLoad(item.id)
                          closeMobile()
                        }}
                        className="block w-full truncate rounded-md px-1.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        title={item.topicTitle || item.rawInput}
                      >
                        <span className="line-clamp-1">{item.topicTitle || item.rawInput}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/20">
        <SidebarMenu>
          {footerItems.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={active}
                  className={cn(
                    "cursor-pointer w-full transition-all duration-200 rounded-md py-2 px-3 flex items-center gap-3",
                    active
                      ? "bg-primary/8 text-primary font-semibold"
                      : "hover:bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm tracking-wide">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
        <p className="text-[10px] tracking-widest text-muted-foreground/60 text-center font-mono uppercase mt-2">
          {branding.name} v1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
