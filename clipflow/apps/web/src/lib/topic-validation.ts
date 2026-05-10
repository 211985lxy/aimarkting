import { z } from "zod"

// ─── Valid code sets (must match seed-topic-engine.ts) ──

export const VALID_ELEMENT_CODES = [
  "cost", "authority", "curiosity", "trust", "emotion", "identity",
  "novelty", "practical", "social", "scarcity", "story", "contrast",
] as const

export const VALID_OPENING_CODES = [
  "curiosity_open", "leverage_open", "pain_open", "extreme_open",
  "fear_open", "contrast_open", "benefit_open",
] as const

export const VALID_STRUCTURE_CODES = [
  "suspense_reveal", "contrast_hook", "three_beat_ramp", "proof_first",
  "pain_solution", "pov_walkthrough", "objection_dialogue", "before_after",
  "universal",
] as const

export const VALID_ENDING_CODES = [
  "interactive", "empathy", "slogan", "reversal",
] as const

// ─── Zod schemas ────────────────────────────────────────

export const TopicCardSchema = z.object({
  title: z.string().min(2, "标题至少2字").max(20, "标题不超过20字"),
  elementCodes: z
    .array(z.enum(VALID_ELEMENT_CODES))
    .min(1, "至少1个元素")
    .max(3, "最多3个元素"),
  openingTypeCode: z.enum(VALID_OPENING_CODES),
  structureCode: z.enum(VALID_STRUCTURE_CODES),
  rationale: z.string().min(5).max(200).optional(),
})

export const TopicCardsSchema = z
  .array(TopicCardSchema)
  .length(4, "必须恰好4个选题")
  .refine(
    (cards) => new Set(cards.map((c) => c.title)).size === cards.length,
    { message: "4个选题标题必须各不相同" },
  )

export const TopicGenerateResponseSchema = z.object({
  topics: TopicCardsSchema,
})

export type TopicCard = z.infer<typeof TopicCardSchema>
export type TopicCards = z.infer<typeof TopicCardsSchema>
