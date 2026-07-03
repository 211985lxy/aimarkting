import type { ComponentType } from "react"
import { Activity, Compass, PenLine, ShieldCheck, Video } from "lucide-react"
import type { ContentFormat } from "@/lib/api/client"

/** 内容智能体 id */
export type AimAgentId =
  | "content_producer"
  | "business_diagnosis"
  | "business_system_diagnosis"
  | "deep_copywriter"
  | "content_review"
  | "persona"

/** 智能体的共享元信息（侧边栏与工作台页面的单一事实源） */
export interface AimAgentMeta {
  id: AimAgentId
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  defaultFormats: ContentFormat[]
}

export const DEFAULT_AIM_AGENT: AimAgentId = "content_producer"

export const AIM_AGENT_OPTIONS: AimAgentMeta[] = [
  {
    id: "business_system_diagnosis",
    title: "商业诊断官",
    description: "商业模式、流量转化、核心矛盾",
    icon: Activity,
    defaultFormats: ["raw_copy"],
  },
  {
    id: "business_diagnosis",
    title: "定位策划官",
    description: "IP定位、内容定位、成交路径",
    icon: ShieldCheck,
    defaultFormats: ["raw_copy"],
  },
  {
    id: "content_producer",
    title: "内容生产官",
    description: "选题、脚本、朋友圈、长文、质检",
    icon: Video,
    defaultFormats: ["video_script"],
  },
  {
    id: "deep_copywriter",
    title: "深度文案官",
    description: "先出框架，纯长篇文案创作",
    icon: PenLine,
    defaultFormats: ["raw_copy"],
  },
  {
    id: "content_review",
    title: "发布质检官",
    description: "成稿质检、平台风险、最小改法",
    icon: ShieldCheck,
    defaultFormats: ["raw_copy"],
  },
  {
    id: "persona",
    title: "人设故事官",
    description: "引导式梳理来时路，产出置顶视频脚本",
    icon: Compass,
    defaultFormats: ["video_script"],
  },
]

const AIM_AGENT_IDS = new Set<AimAgentId>(AIM_AGENT_OPTIONS.map((a) => a.id))

/**
 * 旧 id 归一化映射。内容生产官曾用 "ip_video" 作为公开 id（URL、外部 API、
 * 旧 AimGeneration 记录），现已统一为 "content_producer"。这里保留旧 id 的
 * 归一化，使旧书签链接、旧外部调用、旧数据库行都能正确路由，不报 404。
 */
const LEGACY_AGENT_ID_ALIASES: Record<string, AimAgentId> = {
  ip_video: "content_producer",
}

/** 把旧别名归一化为当前规范 id；非别名原样返回 */
export function normalizeAimAgentId(id: string | null | undefined): string {
  if (!id) return DEFAULT_AIM_AGENT
  return LEGACY_AGENT_ID_ALIASES[id] ?? id
}

/** 按 id 取智能体元信息；非法 id 回退到默认智能体 */
export function getAimAgent(id: string | null | undefined): AimAgentMeta {
  const normalized = normalizeAimAgentId(id) as AimAgentId
  if (AIM_AGENT_IDS.has(normalized)) {
    return AIM_AGENT_OPTIONS.find((a) => a.id === normalized)!
  }
  return AIM_AGENT_OPTIONS.find((a) => a.id === DEFAULT_AIM_AGENT)!
}

/** 判断某个 id 是否是合法的智能体 id（接受旧别名） */
export function isValidAimAgent(id: string | null | undefined): id is AimAgentId {
  if (!id) return false
  return AIM_AGENT_IDS.has(id as AimAgentId) || id in LEGACY_AGENT_ID_ALIASES
}
