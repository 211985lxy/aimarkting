import type { Metadata } from "next"
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
    title: `${branding.name} - AI 视频生成平台`,
    description: `输入文案，自动生成 ${branding.name} 营销短视频`,
    viewport: {
      width: "device-width",
      initialScale: 1,
      maximumScale: 1,
      userScalable: false,
    },
    icons: {
      icon: branding.logoUrl,
      shortcut: branding.logoUrl,
      apple: branding.logoUrl,
    },
  }
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
