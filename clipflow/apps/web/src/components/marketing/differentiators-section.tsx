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
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="mb-4 text-2xl font-bold text-[#25211D] sm:text-3xl lg:text-4xl">
            {t("heading")}
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-[#5F5A52]">
            {t("subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {diffs.map(({ titleKey, descKey }) => (
            <div
              key={titleKey}
              className="flex items-start gap-4 rounded-xl border border-[#E8DED1] bg-[#FAF8F3] p-6 transition-all duration-200 hover:border-[#D14A33]/30 hover:bg-white hover:shadow-md"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#B88C33]/15">
                <CheckCircle className="h-4.5 w-4.5 text-[#B88C33]" />
              </div>
              <div>
                <h3 className="mb-1 text-base font-semibold text-[#25211D]">{t(titleKey)}</h3>
                <p className="text-sm leading-relaxed text-[#6F675E]">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
