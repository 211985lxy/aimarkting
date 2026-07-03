import { LLMClient } from "./client"
import { getProviderConfigs } from "./config"
import { OpenAICompatibleProvider } from "./provider"
import type { LLMProvider, LLMProviderConfig } from "./types"

/**
 * 智能体模型路由策略
 *
 * 核心思路：DeepSeek 走官方直连（无中转差价），其他模型走中转站聚合
 * - 深度文案官 / 定位策划官 → DeepSeek 优先，稳定产出
 * - 内容生产 / 商业诊断 / 数据复盘 → DeepSeek（官方直连，日常分发成本低）
 *
 * provider 名与 config.ts 一致：deepseek / jiekou / openrouter / therouter / glm / openai
 * model 为可选，覆盖 provider 的默认模型（同一 provider 下不同智能体可用不同模型）
 */

type AgentModelRoute = { name: string; model?: string }

const AGENT_ROUTES: Record<string, AgentModelRoute[]> = {
  // ── 高质量写作组 ──
  // Claude 当前受地区限制，先走 DeepSeek；中转模型只做备用。
  deep_copywriter: [
    { name: "deepseek" },
    { name: "jiekou" },
    { name: "openrouter" },
    { name: "therouter" },
    { name: "glm" },
  ],
  business_diagnosis: [
    { name: "deepseek" },
    { name: "jiekou" },
    { name: "openrouter" },
    { name: "therouter" },
    { name: "glm" },
  ],

  // ── DeepSeek 组（日常分发，走官方直连，无中转差价）──
  // DeepSeek 官方直连价格最低，不走中转站加价；直连不可用时才回退到中转站
  content_producer: [
    { name: "deepseek" },
    { name: "jiekou" },
    { name: "glm" },
  ],
  business_system_diagnosis: [
    { name: "deepseek" },
    { name: "jiekou" },
    { name: "glm" },
  ],
  content_review: [
    { name: "deepseek" },
    { name: "jiekou" },
    { name: "glm" },
  ],
}

/**
 * 根据智能体 ID 获取专用的 LLM 实例
 * 按路由配置构造 provider 链，每个 provider 用指定的模型
 */
export function getAgentLLM(agentId: string): LLMClient {
  const routes = AGENT_ROUTES[agentId]

  if (!routes) {
    // 没有特殊配置，使用默认实例（provider 链按 config 顺序）
    return LLMClient.shared()
  }

  const allConfigs = getProviderConfigs()
  const configMap = new Map(allConfigs.map((c) => [c.name, c]))

  const providers: LLMProvider[] = []
  for (const route of routes) {
    const config = configMap.get(route.name)
    if (!config) continue
    // 如果指定了 model，覆盖 provider 的默认模型
    const mergedConfig: LLMProviderConfig = route.model
      ? { ...config, defaultModel: route.model }
      : config
    providers.push(new OpenAICompatibleProvider(mergedConfig))
  }

  if (providers.length === 0) {
    console.warn(`[agent-router] No providers available for agent "${agentId}", using default`)
    return LLMClient.shared()
  }

  return new LLMClient(providers)
}

/**
 * 获取智能体的推荐模型名称（用于日志/可观测）
 */
export function getAgentRecommendedModel(agentId: string): string {
  const routes = AGENT_ROUTES[agentId]
  if (!routes) return "default"

  const allConfigs = getProviderConfigs()
  const firstAvailable = routes.find((r) => allConfigs.some((c) => c.name === r.name))
  if (!firstAvailable) return "default"

  const config = allConfigs.find((c) => c.name === firstAvailable.name)
  return firstAvailable.model || config?.defaultModel || "default"
}
