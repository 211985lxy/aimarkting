"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useBranding } from "@/components/providers/branding-provider"
import { ArrowRight, Play } from "lucide-react"

export function HeroSection() {
  const t = useTranslations("Hero")
  const branding = useBranding()

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0F0A2A] via-[#1E1B4B] to-[#312E81] py-24 sm:py-32 lg:py-40 px-4 sm:px-6 lg:px-8">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#6366F1]/20 rounded-full blur-[120px]" />

      <div className="relative mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-indigo-300 backdrop-blur-sm mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {t("badge")}
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight">
          {t("title")}
          <br />
          <span className="bg-gradient-to-r from-[#818CF8] via-[#6366F1] to-[#A78BFA] bg-clip-text text-transparent">
            {t("titleHighlight")}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-indigo-200/70 max-w-2xl mx-auto leading-relaxed">
          {t("subtitle", { name: branding.name })}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center cursor-pointer bg-[#22C55E] hover:bg-[#16A34A] text-white text-base px-8 py-4 rounded-lg font-semibold transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 w-full sm:w-auto"
          >
            {t("cta")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center cursor-pointer border border-white/20 text-white hover:bg-white/10 text-base px-8 py-4 rounded-lg font-semibold transition-all duration-200 w-full sm:w-auto"
          >
            <Play className="mr-2 h-5 w-5" />
            {t("ctaSecondary")}
          </Link>
        </div>

        {/* Trust line */}
        <p className="mt-8 text-sm text-indigo-300/50">
          {t("trustLine", { count: "3,000" })}
        </p>
      </div>
    </section>
  )
}
