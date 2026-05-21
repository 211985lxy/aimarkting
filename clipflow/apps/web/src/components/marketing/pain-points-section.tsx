"use client"

import { useTranslations } from "next-intl"
import { ArchiveX, FileQuestion, MessageSquareWarning, PenLine } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Pain {
  titleKey: string
  descKey: string
  statKey: string
  statLabelKey: string
  Icon: LucideIcon
}

const pains: Pain[] = [
  { titleKey: "pain1Title", descKey: "pain1Desc", statKey: "pain1Stat", statLabelKey: "pain1StatLabel", Icon: ArchiveX },
  { titleKey: "pain2Title", descKey: "pain2Desc", statKey: "pain2Stat", statLabelKey: "pain2StatLabel", Icon: MessageSquareWarning },
  { titleKey: "pain3Title", descKey: "pain3Desc", statKey: "pain3Stat", statLabelKey: "pain3StatLabel", Icon: PenLine },
  { titleKey: "pain4Title", descKey: "pain4Desc", statKey: "pain4Stat", statLabelKey: "pain4StatLabel", Icon: FileQuestion },
]

export function PainPointsSection() {
  const t = useTranslations("PainPoints")

  return (
    <section className="bg-[#FAF8F3] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="mb-4 text-2xl font-bold text-[#25211D] sm:text-3xl lg:text-4xl">
            {t("heading")}
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-[#5F5A52]">
            {t("subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pains.map(({ titleKey, descKey, statKey, statLabelKey, Icon }) => (
            <div
              key={titleKey}
              className="group relative flex flex-col rounded-xl border border-[#E8DED1] bg-white p-6 transition-all duration-200 hover:border-[#D14A33]/30 hover:shadow-lg hover:shadow-[#8C4A2F]/5"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#D14A33]/10">
                <Icon className="h-5 w-5 text-[#D14A33]" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#25211D]">{t(titleKey)}</h3>
              <p className="mb-4 flex-1 text-sm leading-relaxed text-[#6F675E]">{t(descKey)}</p>
              <div className="border-t border-[#EFE7DC] pt-4">
                <span className="text-xl font-bold text-[#D14A33]">{t(statKey)}</span>
                <span className="mt-0.5 block text-xs text-[#8A8175]">{t(statLabelKey)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
