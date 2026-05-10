"use client"

import { useTranslations } from "next-intl"
import {
  Sparkles,
  Video,
  Flame,
  Share2,
  UserCog,
  Layers,
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
  { titleKey: "feature1Title", descKey: "feature1Desc", tagKey: "feature1Tag", Icon: Sparkles, span: "md:col-span-2" },
  { titleKey: "feature2Title", descKey: "feature2Desc", tagKey: "feature2Tag", Icon: Video, span: "" },
  { titleKey: "feature3Title", descKey: "feature3Desc", tagKey: "feature3Tag", Icon: Flame, span: "" },
  { titleKey: "feature4Title", descKey: "feature4Desc", tagKey: "feature4Tag", Icon: Share2, span: "" },
  { titleKey: "feature5Title", descKey: "feature5Desc", tagKey: "feature5Tag", Icon: UserCog, span: "" },
  { titleKey: "feature6Title", descKey: "feature6Desc", tagKey: "feature6Tag", Icon: Layers, span: "md:col-span-2" },
]

export function FeaturesSection() {
  const t = useTranslations("Features")

  return (
    <section id="features" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1E1B4B] mb-4">
            {t("heading")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {features.map(({ titleKey, descKey, tagKey, Icon, span }) => (
            <div
              key={titleKey}
              className={`group relative flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 transition-all duration-200 hover:border-[#6366F1]/30 hover:shadow-lg hover:shadow-indigo-500/5 ${span ?? ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366F1]/10 group-hover:bg-[#6366F1] transition-colors duration-200">
                  <Icon className="h-5 w-5 text-[#6366F1] group-hover:text-white transition-colors duration-200" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium">
                  {t(tagKey)}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-[#1E1B4B]">{t(titleKey)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
