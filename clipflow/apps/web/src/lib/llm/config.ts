import type { LLMProviderConfig } from "./types"

export function getProviderConfigs(): LLMProviderConfig[] {
  const configs: LLMProviderConfig[] = []

  // Primary: TheRouter — unified LLM gateway
  if (process.env.THEROUTER_API_KEY) {
    configs.push({
      name: "therouter",
      apiKey: process.env.THEROUTER_API_KEY,
      baseURL: process.env.THEROUTER_BASE_URL || "https://api.therouter.ai/v1",
      defaultModel: process.env.THEROUTER_MODEL || "anthropic/claude-sonnet-4.5",
    })
  }

  // Fallback: Native OpenAI
  if (process.env.OPENAI_API_KEY) {
    configs.push({
      name: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.openai.com/v1",
      defaultModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    })
  }

  return configs
}
