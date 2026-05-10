import { z } from "zod"

/**
 * Zod validation schemas for v2 IP Profile three-dimensional positioning
 *
 * Enforces:
 * - Exact field structure (prevents LLM hallucination)
 * - Ratio validation (themes must sum to 100)
 * - Min/max constraints (prevents degenerate outputs)
 * - Array size limits (ensures quality over quantity)
 */

export const BusinessPositioningSchema = z.object({
  core: z.string().min(2, "核心定位至少2个字").max(100, "核心定位不超过100字"),
  audience: z.string().min(2, "目标人群至少2个字").max(100, "目标人群不超过100字"),
  value: z.string().min(5, "核心价值至少5个字").max(200, "核心价值不超过200字"),
  differentiator: z.string().min(5, "差异化至少5个字").max(200, "差异化不超过200字"),
})

export const PersonaDesignSchema = z.object({
  expertiseLevel: z.string().min(2, "专业度维度至少2个字").max(50, "专业度维度不超过50字"),
  expressionStyle: z.string().min(2, "表达风格维度至少2个字").max(50, "表达风格维度不超过50字"),
  traits: z
    .array(z.string().min(1, "人设标签不能为空").max(20, "人设标签不超过20字"))
    .min(2, "至少需要2个人设标签")
    .max(8, "人设标签最多8个"),
})

export const ContentThemeSchema = z.object({
  name: z.string().min(1, "主题名称不能为空").max(50, "主题名称不超过50字"),
  ratio: z
    .number()
    .int("比例必须是整数")
    .min(5, "单个主题比例至少5%")
    .max(80, "单个主题比例不超过80%"),
})

export const ContentStrategySchema = z
  .object({
    themes: z
      .array(ContentThemeSchema)
      .min(2, "至少需要2个内容主题")
      .max(5, "内容主题最多5个"),
    formats: z
      .array(z.string().min(1, "内容形式不能为空").max(30, "内容形式不超过30字"))
      .min(1, "至少需要1个内容形式")
      .max(4, "内容形式最多4个"),
    rhythm: z.string().min(1, "更新节奏不能为空").max(100, "更新节奏不超过100字"),
  })
  .refine(
    (data) => {
      const sum = data.themes.reduce((acc, t) => acc + t.ratio, 0)
      return sum === 100
    },
    {
      message: "内容主题比例之和必须等于100",
      path: ["themes"],
    }
  )

export const ThreeDPositioningSchema = z.object({
  business: BusinessPositioningSchema,
  persona: PersonaDesignSchema,
  content: ContentStrategySchema,
})

export type BusinessPositioning = z.infer<typeof BusinessPositioningSchema>
export type PersonaDesign = z.infer<typeof PersonaDesignSchema>
export type ContentStrategy = z.infer<typeof ContentStrategySchema>
export type ThreeDPositioning = z.infer<typeof ThreeDPositioningSchema>

/**
 * Normalize theme ratios to sum to 100
 *
 * @param themes Array of themes with ratios
 * @returns Normalized themes with ratios summing to 100
 * @throws Error if all ratios are zero
 */
export function normalizeThemeRatios(
  themes: Array<{ name: string; ratio: number }>
): Array<{ name: string; ratio: number }> {
  const sum = themes.reduce((acc, t) => acc + t.ratio, 0)

  if (sum === 0) {
    throw new Error("Cannot normalize: all ratios are zero")
  }

  // Normalize to sum to 100
  const normalized = themes.map((t) => ({
    name: t.name,
    ratio: Math.round((t.ratio / sum) * 100),
  }))

  // Handle rounding errors: adjust the largest ratio
  const normalizedSum = normalized.reduce((acc, t) => acc + t.ratio, 0)
  if (normalizedSum !== 100) {
    const diff = 100 - normalizedSum
    const largestIndex = normalized.reduce(
      (maxIdx, t, idx, arr) => (t.ratio > arr[maxIdx].ratio ? idx : maxIdx),
      0
    )
    normalized[largestIndex].ratio += diff
  }

  return normalized
}

/**
 * Auto-fix positioning by normalizing theme ratios
 *
 * @param positioning Raw positioning data from LLM
 * @returns Valid positioning after auto-fix, or null if unfixable
 */
export function autoFixPositioning(
  positioning: any
): ThreeDPositioning | null {
  try {
    // Fix persona traits that exceed 20 characters (truncate to 18 + "…")
    if (positioning?.persona?.traits) {
      const traits = positioning.persona.traits
      if (Array.isArray(traits)) {
        positioning.persona.traits = traits.map((t: unknown) => {
          if (typeof t !== "string") return t
          return t.length > 20 ? t.slice(0, 18) + "…" : t
        })
      }
    }

    // Try to fix theme ratios if content exists
    if (positioning?.content?.themes) {
      const themes = positioning.content.themes
      if (Array.isArray(themes) && themes.length >= 2) {
        const normalizedThemes = normalizeThemeRatios(themes)
        positioning.content.themes = normalizedThemes
      }
    }

    // Validate after fix
    return ThreeDPositioningSchema.parse(positioning)
  } catch (error) {
    console.error("[auto-fix] Failed to fix positioning:", error)
    return null
  }
}
