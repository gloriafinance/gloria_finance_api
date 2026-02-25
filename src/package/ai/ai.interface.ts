import type { Schema } from "@google/generative-ai"
import type { AIProviderError } from "@/package/ai/errors/AIProviderError"

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

export type AIRepairInvalidResponseInput = {
  systemPrompt: string
  userPrompt: string
  schemaResponse: Schema
  invalidPayload: unknown
  reason: AIProviderError
}

export interface IProxyIAService {
  execute(
    systemPrompt: string,
    userPrompt: string,
    schemaResponse: Schema
  ): Promise<AIExecutionResult>
  repairInvalidResponse?(
    input: AIRepairInvalidResponseInput
  ): Promise<AIExecutionResult>
}
