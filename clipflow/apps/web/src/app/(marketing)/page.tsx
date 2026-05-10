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

export async function generateMetadata(): Promise<Metadata> {
  const [store, branding] = await Promise.all([cookies(), getBrandingConfig()])
  const locale = store.get("locale")?.value ?? "zh"
  const isZh = locale === "zh"

  return {
    title: isZh
      ? `${branding.name} - AI 营销短视频流水线`
      : `${branding.name} - AI Video Marketing Pipeline`,
    description: isZh
      ? `小企业主的 AI 视频创作助手——输入文案，自动生成专业营销短视频`
      : "AI-powered video creation for small businesses — from copy to professional marketing video",
    openGraph: {
      title: isZh
        ? `${branding.name} - AI 营销短视频流水线`
        : `${branding.name} - AI Video Marketing Pipeline`,
      description: isZh
        ? "小企业主的 AI 视频创作助手"
        : "AI-powered video creation for small businesses",
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
