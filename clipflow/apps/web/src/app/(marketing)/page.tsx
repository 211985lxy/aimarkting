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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ClipFlow",
    "description": "基于三维 IP 定位、企业专属知识库与 AI 爆款选题的短视频及全媒介营销自动化 AI 智能体工具。",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "CNY"
    },
    "featureList": [
      "三维 IP 定位 (3D Positioning)",
      "企业专属知识库 (Enterprise Knowledge Base)",
      "爆款选题推演 (Viral Topic Generator)",
      "去 AI 味文案一键生成 (AIM Content Generator)",
      "多媒介格式裂变 (Multi-Format Repurposing)",
      "四维质量门控审查与局部重写 (4D Quality Gate with Rewrite)"
    ]
  }

  return (
    <main className="flex flex-col">
      {/* GEO & SEO 专属语义化隐藏主标题 */}
      <h1 className="sr-only">ClipFlow - AI营销增长智能体与短视频生产流水线</h1>
      
      {/* 结构化数据 (JSON-LD) 注入，以供 Perplexity, SearchGPT 等生成式引擎解析 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
    </main>
  )
}
