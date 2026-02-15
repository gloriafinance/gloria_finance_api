import type { Schema } from "@google/generative-ai"

export type AIExecutionMeta = {
  model?: string
  remainingRequests?: number
  remainingTokens?: number
  resetAtUnixMs?: number
}

export type AIExecutionResult = {
  data: unknown
  meta?: AIExecutionMeta
}

export interface IProxyIAService {
  execute(prompt: string, schemaResponse: Schema): Promise<AIExecutionResult>
}
