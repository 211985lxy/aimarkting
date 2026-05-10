import type { IpProfile } from "@/generated/prisma/client"
import type {
  BusinessPositioning,
  PersonaDesign,
  ContentStrategy,
} from "@/types/ip-profile-v2"

/**
 * Narrows Prisma's JsonValue fields to typed v2 structures.
 * Use at the boundary between Prisma reads and downstream consumers.
 */
export interface IpProfileNarrow {
  id: string
  displayName: string | null
  nickname: string | null
  industry: string | null
  primaryOffer: string | null
  targetAudience: string | null
  ipTraits: string | null
  toneOfVoice: string | null
  proofPoints: string | null
  callToAction: string | null
  promptSnapshot: string | null
  isComplete: boolean
  profileVersion: number | null
  business?: Record<string, unknown> | null
  persona?: Record<string, unknown> | null
  content?: Record<string, unknown> | null
}

/** Cast raw Prisma IpProfile → narrowed type safe for downstream consumers */
export function narrowIpProfile(p: IpProfile): IpProfileNarrow {
  return {
    id: p.id,
    displayName: p.displayName,
    nickname: p.nickname,
    industry: p.industry,
    primaryOffer: p.primaryOffer,
    targetAudience: p.targetAudience,
    ipTraits: p.ipTraits,
    toneOfVoice: p.toneOfVoice,
    proofPoints: p.proofPoints,
    callToAction: p.callToAction,
    promptSnapshot: p.promptSnapshot,
    isComplete: p.isComplete,
    profileVersion: p.profileVersion,
    business: p.business && typeof p.business === "object" && !Array.isArray(p.business)
      ? (p.business as Record<string, unknown>)
      : null,
    persona: p.persona && typeof p.persona === "object" && !Array.isArray(p.persona)
      ? (p.persona as Record<string, unknown>)
      : null,
    content: p.content && typeof p.content === "object" && !Array.isArray(p.content)
      ? (p.content as Record<string, unknown>)
      : null,
  }
}

/** Check that a JSON field is a non-null object with at least one non-empty value */
function isNonEmptyObject(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return Object.values(obj).some((v) => {
    if (typeof v === "string") return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === "number") return true
    if (typeof v === "object" && v !== null) return isNonEmptyObject(v)
    return false
  })
}

export interface IpProfileInput {
  displayName?: string | null
  nickname?: string | null
  industry?: string | null
  primaryOffer?: string | null
  targetAudience?: string | null
  ipTraits?: string | null
  toneOfVoice?: string | null
  proofPoints?: string | null
  callToAction?: string | null
}

export interface IpProfileView extends IpProfile {
  missingFields: string[]
}

const REQUIRED_FIELDS: Array<keyof IpProfileInput> = [
  "displayName",
  "industry",
  "primaryOffer",
  "targetAudience",
  "ipTraits",
  "toneOfVoice",
  "callToAction",
]

export function normalizeIpProfileInput(input: IpProfileInput): IpProfileInput {
  return {
    displayName: clean(input.displayName),
    nickname: clean(input.nickname),
    industry: clean(input.industry),
    primaryOffer: clean(input.primaryOffer),
    targetAudience: clean(input.targetAudience),
    ipTraits: clean(input.ipTraits),
    toneOfVoice: clean(input.toneOfVoice),
    proofPoints: clean(input.proofPoints),
    callToAction: clean(input.callToAction),
  }
}

export function getIpProfileMissingFields(
  input: Partial<IpProfile>
): string[] {
  const version = input.profileVersion ?? 1

  if (version === 1) {
    // v1: check 7 flat fields
    return REQUIRED_FIELDS.filter((field) => {
      const value = input[field as keyof typeof input]
      return typeof value !== "string" || value.trim() === ""
    })
  }

  if (version === 2) {
    // v2: check 3D positioning fields have non-empty content
    const missing: string[] = []
    if (!isNonEmptyObject(input.business)) missing.push("business")
    if (!isNonEmptyObject(input.persona)) missing.push("persona")
    if (!isNonEmptyObject(input.content)) missing.push("content")
    return missing
  }

  return []
}

export function isIpProfileComplete(input: Partial<IpProfile>): boolean {
  return getIpProfileMissingFields(input).length === 0
}

export function buildIpProfilePromptSnapshot(
  input: Partial<IpProfile>
): string {
  const version = input.profileVersion ?? 1

  if (version === 1) {
    // v1: use flat field format (existing logic)
    const displayName = input.displayName?.trim() || input.nickname?.trim() || "未命名IP"
    const sections = [
      `你正在为个人 IP「${displayName}」创作文案。`,
      `行业：${input.industry?.trim() || "未提供"}`,
      `主营内容：${input.primaryOffer?.trim() || "未提供"}`,
      `目标受众：${input.targetAudience?.trim() || "未提供"}`,
      `IP特征：${input.ipTraits?.trim() || "未提供"}`,
      `表达口吻：${input.toneOfVoice?.trim() || "未提供"}`,
      `可信背书：${input.proofPoints?.trim() || "未提供"}`,
      `行动号召：${input.callToAction?.trim() || "未提供"}`,
    ]
    return sections.join("\n")
  }

  if (version === 2 && input.business && input.persona && input.content) {
    // v2: use 3D positioning structure (Prisma JSON → typed cast via unknown)
    const business = input.business as unknown as BusinessPositioning
    const persona = input.persona as unknown as PersonaDesign
    const content = input.content as unknown as ContentStrategy

    const displayName = input.displayName?.trim() || "未命名IP"

    const sections = [
      `你正在为个人 IP「${displayName}」创作文案。`,
      ``,
      `【商业定位】`,
      `核心定位：${business.core || "未提供"}`,
      `目标人群：${business.audience || "未提供"}`,
      `核心价值：${business.value || "未提供"}`,
      `差异化：${business.differentiator || "未提供"}`,
      ``,
      `【人设设计】`,
      `专业度：${persona.expertiseLevel || "未提供"}`,
      `表达风格：${persona.expressionStyle || "未提供"}`,
      `人设标签：${persona.traits?.join("、") || "未提供"}`,
      ``,
      `【内容策略】`,
      `内容主题：${content.themes?.map((t) => `${t.name}(${t.ratio}%)`).join("、") || "未提供"}`,
      `内容形式：${content.formats?.join("、") || "未提供"}`,
      `更新节奏：${content.rhythm || "未提供"}`,
    ]
    return sections.join("\n")
  }

  // Fallback for incomplete v2 or unknown version
  return `个人 IP 档案未完成，无法生成提示词快照。`
}

export function buildIpProfileView(profile: IpProfile | null): {
  profile: IpProfileNarrow | null
  isComplete: boolean
  missingFields: string[]
  promptSnapshot: string | null
} {
  if (!profile) {
    return {
      profile: null,
      isComplete: false,
      missingFields: [...REQUIRED_FIELDS],
      promptSnapshot: null,
    }
  }

  const missingFields = getIpProfileMissingFields(profile)
  return {
    profile: narrowIpProfile(profile),
    isComplete: missingFields.length === 0,
    missingFields,
    promptSnapshot: profile.promptSnapshot,
  }
}

function clean(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}
