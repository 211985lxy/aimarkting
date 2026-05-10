"use client"

import { useTranslations } from "next-intl"
import {
  MonitorPlay,
  MessageCircle,
  BookOpen,
  Zap,
  Music2,
  Youtube,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Platform {
  nameKey: string
  Icon: LucideIcon
}

const platforms: Platform[] = [
  { nameKey: "douyin", Icon: Music2 },
  { nameKey: "wxVideo", Icon: MessageCircle },
  { nameKey: "xiaohongshu", Icon: BookOpen },
  { nameKey: "kuaishou", Icon: Zap },
  { nameKey: "tiktok", Icon: MonitorPlay },
  { nameKey: "youtube", Icon: Youtube },
]

export function PlatformsSection() {
  const t = useTranslations("Platforms")

  return (
    <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-100">
      <div className="mx-auto max-w-7xl">
        <p className="text-center text-sm font-medium text-muted-foreground mb-8 tracking-wide uppercase">
          {t("heading")}
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 lg:gap-16">
          {platforms.map(({ nameKey, Icon }) => (
            <div
              key={nameKey}
              className="flex items-center gap-2.5 text-muted-foreground/60 hover:text-[#6366F1] transition-colors duration-200 cursor-default"
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{t(nameKey)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
