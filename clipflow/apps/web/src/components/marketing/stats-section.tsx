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
    <section className="bg-[#25211D] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-12 text-center text-2xl font-bold text-white sm:mb-16 sm:text-3xl lg:text-4xl">
          {t("heading")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {stats.map(({ valueKey, labelKey }) => (
            <div
              key={valueKey}
              className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-8 text-center sm:py-10"
            >
              <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                {t(valueKey)}
              </span>
              <span className="text-sm font-medium text-white/65 sm:text-base">
                {t(labelKey)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
