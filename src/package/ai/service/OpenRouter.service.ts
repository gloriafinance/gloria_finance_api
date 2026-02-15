import { Logger } from "@/Shared/adapter"
import type { Schema } from "@google/generative-ai"
import type {
  AIExecutionMeta,
  AIExecutionResult,
  IProxyIAService,
} from "@/package/ai/ai.interface"
import { normalizeStructuredSchema } from "@/package/ai/helpers/NormalizeStructuredSchema.helper"
import { buildAIProviderError } from "@/package/ai/helpers/BuildAIProviderError.helper"
import { findAIProviderByService } from "@/package/ai/helpers/AIProviderConfig.helper"

type OpenRouterChoice = {
  message?: {
    content?: string
  }
}

type OpenRouterResponse = {
  error?: {
    message?: string
  }
  choices?: OpenRouterChoice[]
  [key: string]: unknown
}

export class OpenRouterService implements IProxyIAService {
  private static _instance: OpenRouterService | null = null

  private logger = Logger(OpenRouterService.name)

  static getInstance() {
    if (!this._instance) {
      this._instance = new OpenRouterService()
    }
    return this._instance
  }

  async execute(
    prompt: string,
    schemaResponse: Schema
  ): Promise<AIExecutionResult> {
    const providerCfg = findAIProviderByService("openrouter")
    const apiKey = providerCfg?.apiKey
    if (!apiKey) {
      throw buildAIProviderError({
        provider: "OpenRouter",
        message:
          "Missing apiKey in AI_PROVIDER_CONFIG for service 'openrouter'",
      })
    }

    const model = providerCfg?.model
    if (!model) {
      throw buildAIProviderError({
        provider: "OpenRouter",
        message: "Missing model in AI_PROVIDER_CONFIG for service 'openrouter'",
      })
    }
    const normalizedSchema = normalizeStructuredSchema(schemaResponse)

    this.logger.info(`🚀 Enviando datos a OpenRouter (${model})...`)

    const firstAttempt = await this.requestOpenRouter(apiKey, {
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "devotional_response",
          strict: true,
          schema: normalizedSchema,
        },
      },
    })

    if (!firstAttempt.ok) {
      this.logger.error(
        `❌ ERROR CONECTANDO CON OPENROUTER: ${firstAttempt.message} | status=${firstAttempt.status} ${firstAttempt.statusText} | payload=${firstAttempt.payloadText}`
      )
      throw buildAIProviderError({
        provider: "OpenRouter",
        status: firstAttempt.status,
        message: firstAttempt.message,
      })
    }

    return {
      data: this.parseResponseContent(firstAttempt.payload),
      meta: {
        model,
        ...firstAttempt.meta,
      },
    }
  }

  private async requestOpenRouter(
    apiKey: string,
    body: Record<string, unknown>
  ): Promise<{
    ok: boolean
    status: number
    statusText: string
    message: string
    payloadText: string
    payload: OpenRouterResponse
    meta: AIExecutionMeta
  }> {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )

    const raw = await response.text()
    let payload: OpenRouterResponse = {}

    try {
      payload = JSON.parse(raw) as OpenRouterResponse
    } catch {
      payload = {}
    }

    const message =
      payload?.error?.message ??
      `OpenRouter request failed with status ${response.status}`

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      message,
      payloadText: raw,
      payload,
      meta: this.extractQuotaMeta(response.headers),
    }
  }

  private extractQuotaMeta(headers: Headers): AIExecutionMeta {
    const remainingRequests = this.toNumber(
      headers.get("x-ratelimit-remaining-requests") ??
        headers.get("x-ratelimit-remaining")
    )
    const remainingTokens = this.toNumber(
      headers.get("x-ratelimit-remaining-tokens")
    )
    const resetAtUnixMs = this.parseResetHeader(
      headers.get("x-ratelimit-reset-requests") ??
        headers.get("x-ratelimit-reset")
    )

    return {
      remainingRequests,
      remainingTokens,
      resetAtUnixMs,
    }
  }

  private parseResetHeader(value: string | null): number | undefined {
    if (!value) return undefined

    const asNum = Number(value)
    if (Number.isFinite(asNum)) {
      return asNum > 10_000_000_000 ? asNum : Date.now() + asNum * 1000
    }

    const asDate = Date.parse(value)
    return Number.isNaN(asDate) ? undefined : asDate
  }

  private toNumber(value: string | null): number | undefined {
    if (!value) return undefined
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }

  private parseResponseContent(payload: OpenRouterResponse): unknown {
    const content = payload.choices?.[0]?.message?.content
    if (!content) {
      throw new Error("OpenRouter returned an empty response")
    }

    try {
      return JSON.parse(content)
    } catch {
      throw new Error(
        `OpenRouter returned non-JSON content: ${content.slice(0, 500)}`
      )
    }
  }
}
