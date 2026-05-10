"use client"

import { useTranslations } from "next-intl"
import {
  ShoppingBag,
  Store,
  GraduationCap,
  Megaphone,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface UseCase {
  titleKey: string
  descKey: string
  statKey: string
  Icon: LucideIcon
  gradient: string
}

const useCases: UseCase[] = [
  {
    titleKey: "case1Title",
    descKey: "case1Desc",
    statKey: "case1Stat",
    Icon: ShoppingBag,
    gradient: "from-orange-500 to-pink-500",
  },
  {
    titleKey: "case2Title",
    descKey: "case2Desc",
    statKey: "case2Stat",
    Icon: Store,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    titleKey: "case3Title",
    descKey: "case3Desc",
    statKey: "case3Stat",
    Icon: GraduationCap,
    gradient: "from-violet-500 to-purple-500",
  },
  {
    titleKey: "case4Title",
    descKey: "case4Desc",
    statKey: "case4Stat",
    Icon: Megaphone,
    gradient: "from-emerald-500 to-teal-500",
  },
]

export function UseCasesSection() {
  const t = useTranslations("UseCases")

  return (
    <section id="use-cases" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1E1B4B] mb-4">
            {t("heading")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {useCases.map(({ titleKey, descKey, statKey, Icon, gradient }) => (
            <div
              key={titleKey}
              className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-1"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white mb-5 shadow-lg`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-[#1E1B4B] mb-2">{t(titleKey)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-4">
                {t(descKey)}
              </p>
              <div className="pt-4 border-t border-gray-100">
                <span className="text-sm font-semibold text-[#6366F1]">{t(statKey)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
