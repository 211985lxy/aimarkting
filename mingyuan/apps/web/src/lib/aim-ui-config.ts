import type { ComponentType } from "react"
import { Activity, PenLine, RefreshCw, ShieldCheck, Video } from "lucide-react"
import type { ContentFormat } from "@/lib/api/client"

/** 内容智能体 id */
export type AimAgentId =
  | "ip_video"
  | "business_diagnosis"
  | "business_system_diagnosis"
  | "deep_copywriter"
  | "content_review"

/** 智能体的共享元信息（侧边栏与工作台页面的单一事实源） */
export interface AimAgentMeta {
  id: AimAgentId
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  defaultFormats: ContentFormat[]
}

export const DEFAULT_AIM_AGENT: AimAgentId = "ip_video"

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
    id: "ip_video",
    title: "内容生产官",
    description: "选题、脚本、朋友圈、长文、质检",
    icon: Video,
    defaultFormats: ["video_script", "shooting_brief", "moments_post", "community_message"],
  },
  {
    id: "deep_copywriter",
    title: "深度文案官",
    description: "观点、结构、钩子、可拆分母稿",
    icon: PenLine,
    defaultFormats: ["raw_copy"],
  },
  {
    id: "content_review",
    title: "数据复盘官",
    description: "发布后数据复盘、优化、复用",
    icon: RefreshCw,
    defaultFormats: ["raw_copy"],
  },
]

const AIM_AGENT_IDS = new Set<AimAgentId>(AIM_AGENT_OPTIONS.map((a) => a.id))

/** 按 id 取智能体元信息；非法 id 回退到默认智能体 */
export function getAimAgent(id: string | null | undefined): AimAgentMeta {
  if (id && AIM_AGENT_IDS.has(id as AimAgentId)) {
    return AIM_AGENT_OPTIONS.find((a) => a.id === id)!
  }
  return AIM_AGENT_OPTIONS.find((a) => a.id === DEFAULT_AIM_AGENT)!
}

/** 判断某个 id 是否是合法的智能体 id */
export function isValidAimAgent(id: string | null | undefined): id is AimAgentId {
  return !!id && AIM_AGENT_IDS.has(id as AimAgentId)
}
