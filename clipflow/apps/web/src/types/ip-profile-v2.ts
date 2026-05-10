/**
 * v2 IP Profile Types
 *
 * Three-dimensional IP positioning system:
 * - Business Positioning: What you do and who you serve
 * - Persona Design: How you present yourself (expertise × expression)
 * - Content Strategy: What and how you create
 */

export interface BusinessPositioning {
  core: string              // 核心定位: "空调维修专家"
  audience: string          // 目标人群: "中小商户老板"
  value: string            // 核心价值: "快速解决制冷问题"
  differentiator: string   // 差异化: "24小时上门+质保一年"
}

export interface PersonaDesign {
  expertiseLevel: string       // 专业度维度: "资深从业者" | "新手创业者" | "行业专家"
  expressionStyle: string      // 表达风格维度: "直给型" | "温和型" | "幽默型" | "专业型"
  traits: string[]            // 人设标签: ["敢说真话", "经验老到", "不绕弯子"]
}

export interface ContentTheme {
  name: string    // 主题名称: "产品介绍" | "客户案例" | "行业知识"
  ratio: number   // 内容占比: 30 (represents 30%)
}

export interface ContentStrategy {
  themes: ContentTheme[]      // 内容主题分布 (2-5个，ratios sum to 100)
  formats: string[]          // 内容形式: ["真人出镜", "数字人", "混剪"]
  rhythm: string            // 更新节奏: "每日一更" | "周更3次"
}

export interface ThreeDPositioning {
  business: BusinessPositioning
  persona: PersonaDesign
  content: ContentStrategy
}

/**
 * Survey input from 5-question wizard
 */
export interface SurveyInput {
  surveyIndustry: string           // Q1: 行业 (single selection)
  surveyTargetCustomer: string     // Q2: 目标客户 (free text)
  surveyMonetization: string[]     // Q3: 变现方式 (multi-select)
  surveyPersonalTraits: string     // Q4: 个人特质 (free text)
  surveyContentGoal: string        // Q5: 内容目标 (single selection)
}

/**
 * Extended IpProfile type with v2 fields
 */
export interface IpProfileV2 {
  // v1 flat fields
  id: string
  userId: string
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
  isActive: boolean
  createdAt: Date
  updatedAt: Date

  // v2 version control
  profileVersion: number | null

  // v2 survey inputs
  surveyIndustry: string | null
  surveyTargetCustomer: string | null
  surveyMonetization: any | null  // JSON type (string[] in runtime)
  surveyPersonalTraits: string | null
  surveyContentGoal: string | null

  // v2 positioning (structured data)
  business: any | null            // JSON type (BusinessPositioning in runtime)
  persona: any | null             // JSON type (PersonaDesign in runtime)
  content: any | null             // JSON type (ContentStrategy in runtime)
}

/**
 * Type guard to check if profile is v2
 */
export function isV2Profile(profile: any): profile is IpProfileV2 {
  return profile?.profileVersion === 2
}

/**
 * Type guard to check if v2 positioning is complete
 */
export function hasCompletePositioning(profile: IpProfileV2): boolean {
  return !!(
    profile.business &&
    profile.persona &&
    profile.content
  )
}
