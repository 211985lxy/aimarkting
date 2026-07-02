"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { BrandLogo } from "@/components/branding/brand-logo"
import { useBranding } from "@/components/providers/branding-provider"
import {
  LayoutDashboard,
  Settings,
  BriefcaseBusiness,
  BarChart2,
  Target,
  Flame,
  ChevronRight,
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
  DEFAULT_AIM_AGENT,
  getAimAgent,
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
    label: "创作中心",
    items: [
      { title: "工作总览", href: "/home", icon: LayoutDashboard },
      { title: "热点中心", href: "/hot-topics", icon: Flame },
      { title: "IP营销全案", href: "/projects", icon: BriefcaseBusiness },
      { title: "市场洞察", href: "/competitor", icon: BarChart2 },
      { title: "选题中心", href: "/topic-planning", icon: Target },
    ],
  },
]

const footerItems: NavItem[] = [
  { title: "账户设置", href: "/account", icon: Settings },
]

const coreAimAgentIds: AimAgentId[] = [
  "business_system_diagnosis",
  "business_diagnosis",
  "ip_video",
  "deep_copywriter",
  "content_review",
  "persona",
]

const RECENT_ITEMS_PER_AGENT = 4

export function AppSidebar() {
  const [collapsedAgents, setCollapsedAgents] = useState<Set<AimAgentId>>(new Set())
  const [showAllAgents, setShowAllAgents] = useState<Set<AimAgentId>>(new Set())
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

  const historyGroups = coreAimAgentIds
    .map((agentId) => {
      const agent = getAimAgent(agentId)
      const items = history.filter((item) => {
        const itemAgentId = isValidAimAgent(item.agentId) ? item.agentId : DEFAULT_AIM_AGENT
        return itemAgentId === agentId
      })
      return { agent, items }
    })

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
            <SidebarGroupLabel className="px-3 text-sm font-semibold tracking-wide text-foreground/80">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)

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

        {/* AIM 智能体入口常驻；/aim 下按 Codex 侧边栏样式展示历史 */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-sm font-semibold tracking-wide text-foreground/80">
            AIM 智能体
          </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <div className="space-y-3 px-1.5">
                {historyGroups.map(({ agent, items }) => {
                  const Icon = agent.icon
                  const active = isAim && agent.id === activeAgent
                  const collapsed = collapsedAgents.has(agent.id)
                  const showAll = showAllAgents.has(agent.id)
                  const visibleItems = showAll ? items : items.slice(0, RECENT_ITEMS_PER_AGENT)
                  return (
                    <div key={agent.id} className="space-y-0.5">
                      <div
                        className={cn(
                          "flex h-8 w-full items-center rounded-md text-sm font-semibold transition-colors",
                          active ? "bg-muted/70 text-foreground" : "text-foreground/85 hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <button
                          type="button"
                          aria-label={collapsed ? "展开历史" : "折叠历史"}
                          disabled={!isAim || items.length === 0}
                          onClick={() => {
                            setCollapsedAgents((current) => {
                              const next = new Set(current)
                              if (next.has(agent.id)) next.delete(agent.id)
                              else next.add(agent.id)
                              return next
                            })
                          }}
                          className="flex h-8 w-6 shrink-0 items-center justify-center rounded-l-md text-muted-foreground disabled:opacity-0"
                        >
                          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-90")} />
                        </button>
                        <Link
                          href={`/aim?agent=${agent.id}`}
                          onClick={closeMobile}
                          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-r-md pr-1.5"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{agent.title}</span>
                        </Link>
                      </div>

                      {isAim && items.length > 0 && !collapsed && (
                        <div className="space-y-0.5 pl-8">
                          {visibleItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                requestLoad(item.id)
                                closeMobile()
                              }}
                              className="block h-8 w-full rounded-md px-1.5 text-left text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              title={item.topicTitle || item.rawInput}
                            >
                              <span className="block truncate">{item.topicTitle || item.rawInput}</span>
                            </button>
                          ))}

                          {items.length > RECENT_ITEMS_PER_AGENT && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowAllAgents((current) => {
                                  const next = new Set(current)
                                  if (next.has(agent.id)) next.delete(agent.id)
                                  else next.add(agent.id)
                                  return next
                                })
                              }}
                              className="block h-8 w-full rounded-md px-1.5 text-left text-sm font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            >
                              {showAll ? "收起显示" : "展开显示"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
