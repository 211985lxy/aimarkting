"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowRight } from "lucide-react"

export function CTASection() {
  const t = useTranslations("CTA")

  return (
    <section className="relative overflow-hidden py-20 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0F0A2A] via-[#1E1B4B] to-[#312E81]">
      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#6366F1]/15 rounded-full blur-[100px]" />

      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white mb-6 leading-tight">
          {t("heading")}
        </h2>
        <p className="text-lg text-indigo-200/70 mb-10 leading-relaxed">
          {t("subtext")}
        </p>
        <Link
          href="/register"
          className="inline-flex items-center justify-center cursor-pointer bg-[#22C55E] hover:bg-[#16A34A] text-white text-base sm:text-lg px-10 py-4 rounded-lg font-semibold transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
        >
          {t("button")}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
        <p className="mt-4 text-sm text-indigo-300/50">
          {t("note")}
        </p>
      </div>
    </section>
  )
}
