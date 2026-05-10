"use client"

import { useTranslations } from "next-intl"
import { useBranding } from "@/components/providers/branding-provider"
import { BrandLogo } from "@/components/branding/brand-logo"

const footerColumns = [
  {
    headingKey: "product",
    links: [
      { key: "features", href: "#features" },
      { key: "pricing", href: "#" },
      { key: "demo", href: "#" },
      { key: "changelog", href: "#" },
    ],
  },
  {
    headingKey: "resources",
    links: [
      { key: "docs", href: "#" },
      { key: "blog", href: "#" },
      { key: "api", href: "#" },
    ],
  },
  {
    headingKey: "company",
    links: [
      { key: "about", href: "#" },
      { key: "contact", href: "#" },
      { key: "privacy", href: "#" },
      { key: "terms", href: "#" },
    ],
  },
]

export function MarketingFooter() {
  const t = useTranslations("Footer")
  const branding = useBranding()

  return (
    <footer className="bg-[#0F0A2A] border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <BrandLogo className="h-7 w-7" />
              <span className="text-xl font-bold text-white">{branding.name}</span>
            </div>
            <p className="text-sm text-indigo-200/50 leading-relaxed max-w-xs">
              {t("tagline")}
            </p>
          </div>

          {/* Link columns */}
          {footerColumns.map(({ headingKey, links }) => (
            <div key={headingKey}>
              <h3 className="text-sm font-semibold text-white mb-4">{t(headingKey)}</h3>
              <ul className="space-y-2.5">
                {links.map(({ key, href }) => (
                  <li key={key}>
                    <a
                      href={href}
                      className="text-sm text-indigo-200/50 hover:text-white transition-colors duration-200"
                    >
                      {t(key)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <p className="text-sm text-indigo-200/30 text-center">
            {t("copyright")}
          </p>
        </div>
      </div>
    </footer>
  )
}
