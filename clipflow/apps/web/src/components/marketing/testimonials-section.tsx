"use client"

import { useTranslations } from "next-intl"
import { Quote } from "lucide-react"

interface Testimonial {
  quoteKey: string
  nameKey: string
  roleKey: string
  initials: string
  color: string
}

const testimonials: Testimonial[] = [
  {
    quoteKey: "t1Quote",
    nameKey: "t1Name",
    roleKey: "t1Role",
    initials: "ZW",
    color: "bg-gradient-to-br from-blue-500 to-indigo-600",
  },
  {
    quoteKey: "t2Quote",
    nameKey: "t2Name",
    roleKey: "t2Role",
    initials: "LT",
    color: "bg-gradient-to-br from-pink-500 to-rose-600",
  },
  {
    quoteKey: "t3Quote",
    nameKey: "t3Name",
    roleKey: "t3Role",
    initials: "WK",
    color: "bg-gradient-to-br from-emerald-500 to-teal-600",
  },
]

export function TestimonialsSection() {
  const t = useTranslations("Testimonials")

  return (
    <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1E1B4B] text-center mb-12 sm:mb-16">
          {t("heading")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map(({ quoteKey, nameKey, roleKey, initials, color }) => (
            <div
              key={quoteKey}
              className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5"
            >
              <Quote className="h-8 w-8 text-[#6366F1]/20 mb-4" />
              <blockquote className="text-[#1E1B4B] leading-relaxed flex-1 mb-6">
                &ldquo;{t(quoteKey)}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${color} text-white text-sm font-semibold`}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1E1B4B]">{t(nameKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(roleKey)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
