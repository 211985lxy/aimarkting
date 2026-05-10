"use client"

import { useTranslations } from "next-intl"
import { FileText, UserSquare, Zap, ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Step {
  num: number
  titleKey: string
  descKey: string
  Icon: LucideIcon
}

const steps: Step[] = [
  { num: 1, titleKey: "step1Title", descKey: "step1Desc", Icon: FileText },
  { num: 2, titleKey: "step2Title", descKey: "step2Desc", Icon: UserSquare },
  { num: 3, titleKey: "step3Title", descKey: "step3Desc", Icon: Zap },
]

export function HowItWorksSection() {
  const t = useTranslations("HowItWorks")

  return (
    <section id="how-it-works" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1E1B4B] mb-4">
            {t("heading")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-4">
          {steps.map(({ num, titleKey, descKey, Icon }, idx) => (
            <div key={num} className="relative flex flex-col items-center">
              {/* Card */}
              <div className="flex flex-col items-center text-center gap-5 rounded-2xl border border-gray-200 bg-white p-8 w-full transition-all duration-200 hover:border-[#6366F1]/30 hover:shadow-lg hover:shadow-indigo-500/5">
                {/* Step number + icon */}
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#818CF8] text-white shadow-lg shadow-indigo-500/25">
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#22C55E] text-xs font-bold text-white shadow-sm">
                    {num}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[#1E1B4B] mb-2">{t(titleKey)}</h3>
                  <p className="text-muted-foreground leading-relaxed">{t(descKey)}</p>
                </div>
              </div>
              {/* Connector arrow (hidden on last step and mobile) */}
              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-5 lg:-right-2.5 -translate-y-1/2 z-10">
                  <ChevronRight className="h-5 w-5 text-[#6366F1]/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
