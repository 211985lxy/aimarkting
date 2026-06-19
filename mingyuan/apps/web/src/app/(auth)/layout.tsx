"use client"

import { BrandLogo } from "@/components/branding/brand-logo"
import { useBranding } from "@/components/providers/branding-provider"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const branding = useBranding()

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-muted/30 pt-[12vh] sm:pt-0">
      <div className="w-full max-w-md mx-auto px-5">
        <div className="flex items-center justify-center gap-2 mb-6">
          <BrandLogo className="h-10 w-10" />
          <span className="text-2xl font-bold">{branding.name}</span>
        </div>
        {children}
      </div>
    </div>
  )
}
