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
    color: "bg-[#D14A33]",
  },
  {
    quoteKey: "t2Quote",
    nameKey: "t2Name",
    roleKey: "t2Role",
    initials: "LT",
    color: "bg-[#B88C33]",
  },
  {
    quoteKey: "t3Quote",
    nameKey: "t3Name",
    roleKey: "t3Role",
    initials: "WK",
    color: "bg-[#25211D]",
  },
]

export function TestimonialsSection() {
  const t = useTranslations("Testimonials")

  return (
    <section className="bg-[#FAF8F3] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-12 text-center text-2xl font-bold text-[#25211D] sm:mb-16 sm:text-3xl lg:text-4xl">
          {t("heading")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map(({ quoteKey, nameKey, roleKey, initials, color }) => (
            <div
              key={quoteKey}
              className="relative flex flex-col rounded-xl border border-[#E8DED1] bg-white p-6 transition-all duration-200 hover:shadow-lg hover:shadow-[#8C4A2F]/5 sm:p-8"
            >
              <Quote className="mb-4 h-8 w-8 text-[#D14A33]/20" />
              <blockquote className="mb-6 flex-1 leading-relaxed text-[#25211D]">
                &ldquo;{t(quoteKey)}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 border-t border-[#EFE7DC] pt-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${color} text-white text-sm font-semibold`}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#25211D]">{t(nameKey)}</p>
                  <p className="text-xs text-[#8A8175]">{t(roleKey)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
