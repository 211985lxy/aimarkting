import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { BrandingProvider } from "@/components/providers/branding-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import { getBrandingConfig } from "@/lib/branding"
import "./globals.css"

const font = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
})

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBrandingConfig()

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: `${branding.name} - AI营销增长智能体`,
    description: `${branding.name}，帮企业把业务资料、老板经验、项目案例训练成AI营销增长智能体`,
    icons: {
      icon: branding.logoUrl,
      shortcut: branding.logoUrl,
      apple: branding.logoUrl,
    },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const branding = await getBrandingConfig()
  const messages = await getMessages()

  return (
    <html lang="zh-CN">
      <body className={`${font.variable} font-sans antialiased`}>
        <BrandingProvider branding={branding}>
          <NextIntlClientProvider messages={messages}>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster richColors position="top-center" />
          </NextIntlClientProvider>
        </BrandingProvider>
      </body>
    </html>
  )
}
