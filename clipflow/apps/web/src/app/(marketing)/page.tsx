import { cookies } from "next/headers"
import type { Metadata } from "next"
import { getBrandingConfig } from "@/lib/branding"
import { HeroSection } from "@/components/marketing/hero-section"
import { PlatformsSection } from "@/components/marketing/platforms-section"
import { PainPointsSection } from "@/components/marketing/pain-points-section"
import { HowItWorksSection } from "@/components/marketing/how-it-works-section"
import { FeaturesSection } from "@/components/marketing/features-section"
import { UseCasesSection } from "@/components/marketing/use-cases-section"
import { StatsSection } from "@/components/marketing/stats-section"
import { TestimonialsSection } from "@/components/marketing/testimonials-section"
import { DifferentiatorsSection } from "@/components/marketing/differentiators-section"
import { CTASection } from "@/components/marketing/cta-section"

function normalizeLocale(locale: string | undefined) {
  return locale?.toLowerCase().replace("_", "-").startsWith("en") ? "en" : "zh"
}

export async function generateMetadata(): Promise<Metadata> {
  const [store, branding] = await Promise.all([cookies(), getBrandingConfig()])
  const locale = normalizeLocale(store.get("locale")?.value)
  const isZh = locale === "zh"

  return {
    title: isZh
      ? `${branding.name} - AI营销增长智能体`
      : `${branding.name} - AI Marketing Growth Agent`,
    description: isZh
      ? `${branding.name}，帮企业把业务资料、老板经验、项目案例训练成AI营销增长智能体`
      : `${branding.name} turns business materials, founder expertise, and project cases into an AI marketing growth agent`,
    openGraph: {
      title: isZh
        ? `${branding.name} - AI营销增长智能体`
        : `${branding.name} - AI Marketing Growth Agent`,
      description: isZh
        ? "把企业资料、老板经验、项目案例训练成增长大脑"
        : "Train business knowledge into an AI marketing growth agent",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
      locale: isZh ? "zh_CN" : "en_US",
      type: "website",
    },
    alternates: {
      canonical: "https://clipflow.ai/",
      languages: {
        "zh-CN": "https://clipflow.ai/",
        "en": "https://clipflow.ai/",
        "x-default": "https://clipflow.ai/",
      },
    },
  }
}

export default function MarketingPage() {
  return (
    <>
      <HeroSection />
      <PlatformsSection />
      <PainPointsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <UseCasesSection />
      <StatsSection />
      <TestimonialsSection />
      <DifferentiatorsSection />
      <CTASection />
    </>
  )
}
