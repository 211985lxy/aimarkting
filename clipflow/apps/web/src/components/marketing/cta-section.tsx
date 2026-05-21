"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowRight } from "lucide-react"

export function CTASection() {
  const t = useTranslations("CTA")

  return (
    <section className="bg-[#FAF8F3] px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-6 text-2xl font-bold leading-tight text-[#25211D] sm:text-3xl lg:text-5xl">
          {t("heading")}
        </h2>
        <p className="mb-10 text-lg leading-relaxed text-[#5F5A52]">
          {t("subtext")}
        </p>
        <Link
          href="/register"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#D14A33] px-10 py-4 text-base font-semibold text-white shadow-lg shadow-[#D14A33]/20 transition-colors duration-200 hover:bg-[#B83F2B] sm:text-lg"
        >
          {t("button")}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
        <p className="mt-4 text-sm text-[#8A8175]">
          {t("note")}
        </p>
      </div>
    </section>
  )
}
