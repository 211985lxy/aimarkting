"use client"

import { useTranslations } from "next-intl"
import { DollarSign, Clock, PenLine, TrendingDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Pain {
  titleKey: string
  descKey: string
  statKey: string
  statLabelKey: string
  Icon: LucideIcon
}

const pains: Pain[] = [
  { titleKey: "pain1Title", descKey: "pain1Desc", statKey: "pain1Stat", statLabelKey: "pain1StatLabel", Icon: DollarSign },
  { titleKey: "pain2Title", descKey: "pain2Desc", statKey: "pain2Stat", statLabelKey: "pain2StatLabel", Icon: Clock },
  { titleKey: "pain3Title", descKey: "pain3Desc", statKey: "pain3Stat", statLabelKey: "pain3StatLabel", Icon: PenLine },
  { titleKey: "pain4Title", descKey: "pain4Desc", statKey: "pain4Stat", statLabelKey: "pain4StatLabel", Icon: TrendingDown },
]

export function PainPointsSection() {
  const t = useTranslations("PainPoints")

  return (
    <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
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
          {pains.map(({ titleKey, descKey, statKey, statLabelKey, Icon }) => (
            <div
              key={titleKey}
              className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-red-200 hover:shadow-lg hover:shadow-red-500/5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 mb-4">
                <Icon className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[#1E1B4B] mb-2">{t(titleKey)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{t(descKey)}</p>
              <div className="pt-4 border-t border-gray-100">
                <span className="text-xl font-bold text-red-500">{t(statKey)}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{t(statLabelKey)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
