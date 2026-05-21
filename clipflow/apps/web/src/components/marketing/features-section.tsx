"use client"

import { useTranslations } from "next-intl"
import {
  BriefcaseBusiness,
  Mic2,
  MessageCircleQuestion,
  PencilLine,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Feature {
  titleKey: string
  descKey: string
  tagKey: string
  Icon: LucideIcon
  span?: string
}

const features: Feature[] = [
  { titleKey: "feature1Title", descKey: "feature1Desc", tagKey: "feature1Tag", Icon: BriefcaseBusiness },
  { titleKey: "feature2Title", descKey: "feature2Desc", tagKey: "feature2Tag", Icon: Mic2 },
  { titleKey: "feature3Title", descKey: "feature3Desc", tagKey: "feature3Tag", Icon: PencilLine },
  { titleKey: "feature4Title", descKey: "feature4Desc", tagKey: "feature4Tag", Icon: MessageCircleQuestion },
]

export function FeaturesSection() {
  const t = useTranslations("Features")

  return (
    <section id="features" className="bg-[#FAF8F3] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="mb-4 text-2xl font-bold text-[#25211D] sm:text-3xl lg:text-4xl">
            {t("heading")}
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-[#5F5A52]">
            {t("subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map(({ titleKey, descKey, tagKey, Icon, span }) => (
            <div
              key={titleKey}
              className={`group relative flex flex-col gap-4 rounded-xl border border-[#E8DED1] bg-white p-6 transition-all duration-200 hover:border-[#D14A33]/30 hover:shadow-lg hover:shadow-[#8C4A2F]/5 sm:p-7 ${span ?? ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D14A33]/10 transition-colors duration-200 group-hover:bg-[#D14A33]">
                  <Icon className="h-5 w-5 text-[#D14A33] transition-colors duration-200 group-hover:text-white" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium">
                  {t(tagKey)}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-[#25211D]">{t(titleKey)}</h3>
              <p className="text-sm leading-relaxed text-[#6F675E]">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
