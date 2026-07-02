export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface CompletionOptions {
  model?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: "json_object" } | { type: "text" }
  stream?: false
}

export interface CompletionResult {
  content: string
  model: string
  provider: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMProviderConfig {
  name: string
  apiKey: string
  baseURL: string
  defaultModel: string
}

export interface LLMProvider {
  readonly name: string
  complete(options: CompletionOptions): Promise<CompletionResult>
  stream?(options: CompletionOptions): AsyncIterable<string>
  isAvailable(): boolean
}
