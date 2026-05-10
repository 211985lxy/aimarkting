"use client"

import { useTranslations } from "next-intl"
import { CheckCircle } from "lucide-react"

interface Diff {
  titleKey: string
  descKey: string
}

const diffs: Diff[] = [
  { titleKey: "diff1Title", descKey: "diff1Desc" },
  { titleKey: "diff2Title", descKey: "diff2Desc" },
  { titleKey: "diff3Title", descKey: "diff3Desc" },
  { titleKey: "diff4Title", descKey: "diff4Desc" },
  { titleKey: "diff5Title", descKey: "diff5Desc" },
  { titleKey: "diff6Title", descKey: "diff6Desc" },
]

export function DifferentiatorsSection() {
  const t = useTranslations("Differentiators")

  return (
    <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1E1B4B] mb-4">
            {t("heading")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {diffs.map(({ titleKey, descKey }) => (
            <div
              key={titleKey}
              className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-slate-50 p-6 transition-all duration-200 hover:border-[#6366F1]/30 hover:bg-white hover:shadow-md"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22C55E]/10 shrink-0 mt-0.5">
                <CheckCircle className="h-4.5 w-4.5 text-[#22C55E]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1E1B4B] mb-1">{t(titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
