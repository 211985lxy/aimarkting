import { getProviderConfigs } from "./config"
import { OpenAICompatibleProvider } from "./provider"
import type { CompletionOptions, CompletionResult, LLMProvider } from "./types"

let _instance: LLMClient | null = null

export class LLMClient {
  private providers: LLMProvider[]

  constructor(providers: LLMProvider[]) {
    this.providers = providers
  }

  /** Get the singleton LLMClient, configured from environment variables. */
  static shared(): LLMClient {
    if (!_instance) {
      const configs = getProviderConfigs()
      const providers = configs
        .map((c) => new OpenAICompatibleProvider(c))
        .filter((p) => p.isAvailable())

      _instance = new LLMClient(providers)
    }
    return _instance
  }

  /** Reset singleton (useful for tests). */
  static reset(): void {
    _instance = null
  }

  /**
   * Run a chat completion through the provider chain.
   * Tries each provider in order; falls back on failure.
   */
  async complete(options: CompletionOptions): Promise<CompletionResult> {
    if (this.providers.length === 0) {
      throw new Error(
        "[llm] No AI providers configured. Set THEROUTER_API_KEY or OPENAI_API_KEY."
      )
    }

    let lastError: Error | undefined

    for (const provider of this.providers) {
      try {
        return await provider.complete(options)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(
          `[llm] Provider "${provider.name}" failed, trying next:`,
          lastError.message
        )
      }
    }

    throw lastError ?? new Error("[llm] All providers failed")
  }

  /** Check if at least one provider is available. */
  get available(): boolean {
    return this.providers.length > 0
  }

  /** List configured provider names. */
  get providerNames(): string[] {
    return this.providers.map((p) => p.name)
  }
}
