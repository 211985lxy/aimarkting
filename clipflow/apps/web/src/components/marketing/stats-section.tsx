"use client"

import { useTranslations } from "next-intl"

interface Stat {
  valueKey: string
  labelKey: string
}

const stats: Stat[] = [
  { valueKey: "stat1Value", labelKey: "stat1Label" },
  { valueKey: "stat2Value", labelKey: "stat2Label" },
  { valueKey: "stat3Value", labelKey: "stat3Label" },
  { valueKey: "stat4Value", labelKey: "stat4Label" },
]

export function StatsSection() {
  const t = useTranslations("Stats")

  return (
    <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#4338CA]">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center mb-12 sm:mb-16">
          {t("heading")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {stats.map(({ valueKey, labelKey }) => (
            <div
              key={valueKey}
              className="flex flex-col items-center text-center gap-2 py-8 sm:py-10 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
            >
              <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                {t(valueKey)}
              </span>
              <span className="text-sm sm:text-base text-indigo-200/70 font-medium">
                {t(labelKey)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
