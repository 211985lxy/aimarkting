"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BrandLogo } from "@/components/branding/brand-logo"
import { useBranding } from "@/components/providers/branding-provider"
import {
  Sparkles,
  LayoutDashboard,
  Settings,
  BriefcaseBusiness,
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
} from "@/components/ui/sidebar"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
    label: "主流程",
    items: [
      { title: "工作台", href: "/home", icon: LayoutDashboard },
      { title: "IP营销全案", href: "/projects", icon: BriefcaseBusiness },
      { title: "AI内容工作台", href: "/aim", icon: Sparkles },
    ],
  },
]

const footerItems: NavItem[] = [
  { title: "账户设置", href: "/account", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const branding = useBranding()

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
        {/* AIM 一键生成快捷按钮 */}
        <div className="px-3 mb-4">
          <Link
            href="/aim"
            className={cn(
              buttonVariants({ variant: "default", size: "default" }),
              "w-full cursor-pointer bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-primary-foreground font-semibold shadow-[0_3px_10px_oklch(0.575_0.205_28.0_/_15%)] border border-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 rounded-lg flex items-center justify-center gap-2"
            )}
          >
            <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
            <span>AI内容工作台</span>
          </Link>
        </div>

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
                            : "hover:bg-secondary/40 text-foreground/80 hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn(
                          "h-4 w-4 transition-transform duration-300",
                          active ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        <span className="text-sm tracking-wide">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
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
                      : "hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
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
