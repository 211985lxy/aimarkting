"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BrandLogo } from "@/components/branding/brand-logo"
import { useBranding } from "@/components/providers/branding-provider"
import {
  Home,
  Video,
  FolderOpen,
  Settings,
  Plus,
  User,
  BarChart2,
  Share2,
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

const navItems = [
  { title: "首页", href: "/home", icon: Home },
  { title: "IP档案", href: "/ip-profile", icon: User },
  { title: "同行对标", href: "/competitor", icon: BarChart2 },
  { title: "我的视频", href: "/videos", icon: Video },
  { title: "资产管理", href: "/assets", icon: FolderOpen },
  { title: "社交发布", href: "/social", icon: Share2 },
  { title: "账户设置", href: "/account", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const branding = useBranding()

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/home" className="flex items-center gap-3 cursor-pointer">
          <BrandLogo className="h-8 w-8 rounded-md" />
          <span className="text-lg font-bold">{branding.name}</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-3 mb-2">
          <Link
            href="/create"
            className={cn(
              buttonVariants({ variant: "default", size: "default" }),
              "w-full cursor-pointer"
            )}
          >
            <Plus className="h-4 w-4 mr-2" />
            创建视频
          </Link>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    }
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground text-center">
          {branding.name} v1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}