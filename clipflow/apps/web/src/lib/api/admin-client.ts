"use client"

import { useAdminStore, getStoredAdminToken } from "@/lib/admin-store"

class AdminApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details: unknown) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
    this.details = details
  }
}

type RequestOptions = RequestInit & {
  auth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, ...init } = options
  const token = auth
    ? useAdminStore.getState().token || getStoredAdminToken()
    : null

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401) {
      useAdminStore.getState().clearSession()
    }
    throw new AdminApiError(
      typeof payload?.error === "string" ? payload.error : `Request failed: ${response.status}`,
      response.status,
      payload
    )
  }

  return payload as T
}

export { AdminApiError }

// ─── Auth ────────────────────────────────────────────────

export async function adminLogin(email: string, password: string) {
  return request<{ token: string; admin: { id: string; email: string; name: string; role: string } }>(
    "/api/admin/auth/login",
    { auth: false, method: "POST", body: JSON.stringify({ email, password }) }
  )
}

// ─── Users ───────────────────────────────────────────────

export async function getAdminUsers(params: { page?: number; pageSize?: number; search?: string; plan?: string }) {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.pageSize) qs.set("pageSize", String(params.pageSize))
  if (params.search) qs.set("search", params.search)
  if (params.plan) qs.set("plan", params.plan)
  return request<{ data: { results: AdminUserItem[]; total: number; page: number; pageSize: number } }>(
    `/api/admin/users?${qs}`
  )
}

export async function getAdminUserDetail(id: string) {
  return request<{ data: AdminUserDetail }>(`/api/admin/users/${id}`)
}

export async function getAdminUserStats() {
  return request<{ data: UserStats }>("/api/admin/users/stats")
}

// ─── Activation Codes ────────────────────────────────────

export async function generateActivationCodes(
  quantity: number,
  durationDays: number,
  batchNote?: string
) {
  return request<{ data: { count: number; batchId: string; durationDays: number } }>(
    "/api/admin/activation-codes/generate",
    { method: "POST", body: JSON.stringify({ quantity, durationDays, batchNote }) }
  )
}

export async function getActivationCodes(params: { page?: number; pageSize?: number; status?: string; batchId?: string }) {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.pageSize) qs.set("pageSize", String(params.pageSize))
  if (params.status) qs.set("status", params.status)
  if (params.batchId) qs.set("batchId", params.batchId)
  return request<{ data: { results: ActivationCodeItem[]; total: number; page: number; pageSize: number; batches: string[] } }>(
    `/api/admin/activation-codes?${qs}`
  )
}

export async function getActivationCodeStats() {
  return request<{ data: CodeStats }>("/api/admin/activation-codes/stats")
}

export function getActivationCodesExportUrl(params: { status?: string; batchId?: string }) {
  const qs = new URLSearchParams()
  if (params.status) qs.set("status", params.status)
  if (params.batchId) qs.set("batchId", params.batchId)
  return `/api/admin/activation-codes/export?${qs}`
}

export async function downloadActivationCodesExport(params: { status?: string; batchId?: string }) {
  const token = useAdminStore.getState().token || getStoredAdminToken()
  const response = await fetch(getActivationCodesExportUrl(params), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (!response.ok) {
    let payload: { error?: string } | null = null

    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (response.status === 401) {
      useAdminStore.getState().clearSession()
    }

    throw new AdminApiError(
      payload?.error ?? `Request failed: ${response.status}`,
      response.status,
      payload
    )
  }

  const blob = await response.blob()
  const disposition = response.headers.get("content-disposition") || ""
  const match = disposition.match(/filename=\"?([^"]+)\"?/)

  return {
    blob,
    fileName: match?.[1] ?? `activation-codes-${Date.now()}.csv`,
  }
}

// ─── Settings ────────────────────────────────────────────

export async function getAdminSettings() {
  return request<{ data: Record<string, SettingItem[]> }>("/api/admin/settings")
}

export async function updateAdminSetting(key: string, value: string) {
  return request<{ data: SettingItem }>(`/api/admin/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  })
}

export async function createAdminSetting(input: { key: string; value: string; type: string; category: string; description?: string }) {
  return request<{ data: SettingItem }>("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// ─── Types ───────────────────────────────────────────────

export interface AdminUserItem {
  id: string
  email: string
  name: string
  plan: string
  createdAt: string
  _count: {
    videoTasks: number
    avatars: number
    assets: number
  }
}

export interface AdminUserDetail {
  id: string
  email: string
  name: string
  plan: string
  createdAt: string
  updatedAt: string
  ipProfile: {
    displayName: string | null
    industry: string | null
    isComplete: boolean
  } | null
  videoTasks: {
    id: string
    status: string
    videoType: string
    avatarName: string
    createdAt: string
    completedAt: string | null
  }[]
  avatars: {
    id: string
    name: string
    status: string
    createdAt: string
  }[]
  assets: {
    id: string
    name: string
    assetType: string
    createdAt: string
  }[]
  _count: {
    videoTasks: number
    avatars: number
    assets: number
    scripts: number
  }
}

export interface UserStats {
  total: number
  byPlan: { plan: string; count: number }[]
  newThisWeek: number
}

export interface ActivationCodeItem {
  id: string
  code: string
  batchId: string
  batchNote: string | null
  durationDays: number
  status: string
  usedAt: string | null
  createdAt: string
  user: { email: string; name: string } | null
}

export interface CodeStats {
  total: number
  unused: number
  used: number
  usageRate: number
}

export interface SettingItem {
  id: string
  key: string
  value: string
  type: string
  category: string
  description: string | null
  updatedBy: string | null
  updatedAt: string
}
