"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useBranding } from "@/components/providers/branding-provider"
import {
  ArrowRight,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  MessageSquareText,
  Play,
  Quote,
  Sparkles,
} from "lucide-react"

const inputs = [
  { label: "企业资料", Icon: BookOpen },
  { label: "老板经验", Icon: Quote },
  { label: "项目案例", Icon: BriefcaseBusiness },
  { label: "客户问答", Icon: MessageSquareText },
]

const outputs = ["案例内容", "老板口播", "卖点人话", "成交话术"]

export function HeroSection() {
  const t = useTranslations("Hero")
  const branding = useBranding()

  return (
    <section className="relative overflow-hidden bg-[#FAF8F3] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_520px]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D14A33]/20 bg-white px-4 py-1.5 text-sm font-medium text-[#D14A33] shadow-sm">
            <Sparkles className="h-4 w-4" />
            {t("badge")}
          </div>

          <h1 className="max-w-4xl text-4xl font-bold leading-[1.08] tracking-tight text-[#25211D] sm:text-5xl lg:text-7xl">
            {t("title")}
            <br />
            <span className="text-[#D14A33]">{t("titleHighlight")}</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5F5A52] sm:text-xl">
            {t("subtitle", { name: branding.name })}
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-[#D14A33] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#D14A33]/20 transition-colors duration-200 hover:bg-[#B83F2B] sm:w-auto"
          >
            {t("cta")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-[#D14A33]/20 bg-white px-8 py-4 text-base font-semibold text-[#25211D] transition-colors duration-200 hover:bg-[#FFF8F4] sm:w-auto"
          >
            <Play className="mr-2 h-5 w-5" />
            {t("ctaSecondary")}
          </Link>
          </div>

          <p className="mt-8 text-sm font-medium text-[#8A8175]">
            {t("trustLine", { count: "3,000" })}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E8DED1] bg-white p-5 shadow-xl shadow-[#8C4A2F]/10">
          <div className="flex items-center justify-between border-b border-[#EFE7DC] pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#B88C33]">
                AIM Growth Brain
              </p>
              <p className="mt-1 text-lg font-bold text-[#25211D]">企业营销资产 AI 化引擎</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D14A33]/10">
              <Brain className="h-6 w-6 text-[#D14A33]" />
            </div>
          </div>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            {inputs.map(({ label, Icon }) => (
              <div key={label} className="rounded-lg border border-[#EFE7DC] bg-[#FAF8F3] p-4">
                <Icon className="mb-3 h-5 w-5 text-[#B88C33]" />
                <p className="text-sm font-semibold text-[#25211D]">{label}</p>
                <p className="mt-1 text-xs text-[#777066]">结构化入库</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-[#25211D] p-5 text-white">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">AIM 智能体输出</p>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">营销服务中</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {outputs.map((item) => (
                <div key={item} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/90">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
