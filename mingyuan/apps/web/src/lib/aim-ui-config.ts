import type { ComponentType } from "react"
import { Video, ShieldCheck, FileText, MessageCircle } from "lucide-react"
import type { ContentFormat } from "@/lib/api/client"

/** 内容智能体 id */
export type AimAgentId = "ip_video" | "business_diagnosis" | "wechat_article" | "moments_conversion"

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
    id: "ip_video",
    title: "脚本创作官",
    description: "短视频脚本、口播稿、拍摄交接单",
    icon: Video,
    defaultFormats: ["video_script", "shooting_brief"],
  },
  {
    id: "business_diagnosis",
    title: "定位策划官",
    description: "IP定位、内容定位、成交路径",
    icon: ShieldCheck,
    defaultFormats: ["raw_copy"],
  },
  {
    id: "wechat_article",
    title: "长文写作官",
    description: "深度文章，把观点讲透",
    icon: FileText,
    defaultFormats: ["wechat_article"],
  },
  {
    id: "moments_conversion",
    title: "私域转化官",
    description: "朋友圈文案、私域承接话术",
    icon: MessageCircle,
    defaultFormats: ["moments_post", "community_message"],
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
