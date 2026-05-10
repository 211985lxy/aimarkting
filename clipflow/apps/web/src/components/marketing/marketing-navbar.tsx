"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Menu } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useBranding } from "@/components/providers/branding-provider"
import { BrandLogo } from "@/components/branding/brand-logo"
import { LanguageSwitcher } from "./language-switcher"

const navLinks = [
  { key: "features", href: "#features" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "useCases", href: "#use-cases" },
]

export function MarketingNavbar() {
  const locale = useLocale()
  const t = useTranslations("Navbar")
  const branding = useBranding()

  return (
    <header className="marketing-nav sticky top-0 z-50 w-full border-b border-white/5 bg-[#0F0A2A]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <BrandLogo className="h-8 w-8" />
          <span className="text-xl font-bold text-white">{branding.name}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(({ key, href }) => (
            <a
              key={key}
              href={href}
              className="text-sm font-medium text-indigo-200/70 hover:text-white transition-colors duration-200"
            >
              {t(key)}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher currentLocale={locale} />
          <Link
            href="/login"
            className="inline-flex items-center justify-center cursor-pointer text-sm font-medium text-indigo-200/70 hover:text-white hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors duration-200"
          >
            {t("login")}
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center cursor-pointer bg-[#22C55E] hover:bg-[#16A34A] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors duration-200"
          >
            {t("cta")}
          </Link>
        </div>

        {/* Mobile nav */}
        <div className="flex md:hidden">
          <Sheet>
            <SheetTrigger className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 cursor-pointer transition-colors duration-200">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-[#1E1B4B] border-white/10">
              <SheetHeader>
                <SheetTitle className="text-white flex items-center gap-2">
                  <BrandLogo className="h-6 w-6" />
                  {branding.name}
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-2 mt-6 px-4">
                {navLinks.map(({ key, href }) => (
                  <a
                    key={key}
                    href={href}
                    className="py-2.5 text-sm font-medium text-indigo-200/70 hover:text-white transition-colors duration-200"
                  >
                    {t(key)}
                  </a>
                ))}
                <div className="border-t border-white/10 my-3" />
                <LanguageSwitcher currentLocale={locale} />
                <Link
                  href="/login"
                  className="py-2.5 text-sm font-medium text-indigo-200/70 hover:text-white transition-colors duration-200"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center cursor-pointer bg-[#22C55E] hover:bg-[#16A34A] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-200"
                >
                  {t("cta")}
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
