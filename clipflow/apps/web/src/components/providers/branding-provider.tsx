"use client"

import React from "react"
import {
  FALLBACK_BRANDING,
  type BrandingConfig,
} from "@/lib/branding-config"

interface BrandingContextValue extends BrandingConfig {
  updateBranding: (next: Partial<BrandingConfig>) => void
}

const BrandingContext = React.createContext<BrandingContextValue>({
  ...FALLBACK_BRANDING,
  updateBranding: () => {},
})

export function BrandingProvider({
  branding,
  children,
}: {
  branding: BrandingConfig
  children: React.ReactNode
}) {
  const [value, setValue] = React.useState<BrandingConfig>(branding)

  const updateBranding = (next: Partial<BrandingConfig>) => {
    setValue((current) => ({ ...current, ...next }))
  }

  return (
    <BrandingContext.Provider value={{ ...value, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const { updateBranding: _updateBranding, ...branding } = React.useContext(BrandingContext)
  return branding
}

export function useBrandingControls() {
  return React.useContext(BrandingContext).updateBranding
}
