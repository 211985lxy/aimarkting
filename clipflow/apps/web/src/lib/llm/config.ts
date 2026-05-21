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

  // Direct: DeepSeek — OpenAI-compatible API
  if (process.env.DEEPSEEK_API_KEY) {
    configs.push({
      name: "deepseek",
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      defaultModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    })
  }

  // Direct: Z.AI / GLM — OpenAI-compatible API
  const glmApiKey = process.env.GLM_API_KEY || process.env.ZAI_API_KEY
  if (glmApiKey) {
    configs.push({
      name: "glm",
      apiKey: glmApiKey,
      baseURL: process.env.GLM_BASE_URL || process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4/",
      defaultModel: process.env.GLM_MODEL || process.env.ZAI_MODEL || "glm-5.1",
    })
  }

  // Fallback: Native OpenAI
  if (process.env.OPENAI_API_KEY) {
    configs.push({
      name: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      defaultModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    })
  }

  return configs
}
