import { Noto_Sans_SC } from "next/font/google"
import { getLocale } from "next-intl/server"
import { MarketingNavbar } from "@/components/marketing/marketing-navbar"
import { MarketingFooter } from "@/components/marketing/marketing-footer"

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "700"],
  preload: false,
  display: "swap",
})

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()

  return (
    <div
      className={`marketing-page flex flex-col min-h-screen ${notoSansSC.variable}`}
      lang={locale === "zh" ? "zh-CN" : "en"}
    >
      <MarketingNavbar />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
