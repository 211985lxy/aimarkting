"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAdminStore } from "@/lib/admin-store"

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isHydrated } = useAdminStore()
  const router = useRouter()

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/admin/login")
    }
  }, [isHydrated, token, router])

  if (!isHydrated || !token) {
    return null
  }

  return <>{children}</>
}
