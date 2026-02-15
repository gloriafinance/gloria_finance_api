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

type GroqChoice = {
  message?: {
    content?: string
  }
}

type GroqResponse = {
  error?: {
    message?: string
  }
  choices?: GroqChoice[]
  [key: string]: unknown
}

export class GroqService implements IProxyIAService {
  private static _instance: GroqService | null = null

  private logger = Logger(GroqService.name)

  static getInstance() {
    if (!this._instance) {
      this._instance = new GroqService()
    }
    return this._instance
  }

  async execute(
    prompt: string,
    schemaResponse: Schema
  ): Promise<AIExecutionResult> {
    const providerCfg = findAIProviderByService("groq")
    const apiKey = providerCfg?.apiKey
    if (!apiKey) {
      throw buildAIProviderError({
        provider: "Groq",
        message: "Missing apiKey in AI_PROVIDER_CONFIG for service 'groq'",
      })
    }

    const model = providerCfg?.model
    if (!model) {
      throw buildAIProviderError({
        provider: "Groq",
        message: "Missing model in AI_PROVIDER_CONFIG for service 'groq'",
      })
    }
    const normalizedSchema = normalizeStructuredSchema(schemaResponse)

    this.logger.info(`🚀 Enviando datos a Groq (${model})...`)

    const request = await this.requestGroq(apiKey, {
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

    if (!request.ok) {
      this.logger.error(
        `❌ ERROR CONECTANDO CON GROQ: ${request.message} | status=${request.status} ${request.statusText} | payload=${request.payloadText}`
      )
      throw buildAIProviderError({
        provider: "Groq",
        status: request.status,
        message: request.message,
      })
    }

    return {
      data: this.parseContent(request.payload),
      meta: {
        model,
        ...request.meta,
      },
    }
  }

  private async requestGroq(
    apiKey: string,
    body: Record<string, unknown>
  ): Promise<{
    ok: boolean
    status: number
    statusText: string
    message: string
    payloadText: string
    payload: GroqResponse
    meta: AIExecutionMeta
  }> {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
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
    let payload: GroqResponse = {}

    try {
      payload = JSON.parse(raw) as GroqResponse
    } catch {
      payload = {}
    }

    const message =
      payload?.error?.message ??
      `Groq request failed with status ${response.status}`

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

  private parseContent(payload: GroqResponse): unknown {
    const content = payload.choices?.[0]?.message?.content
    if (!content) {
      throw new Error("Groq returned an empty response")
    }

    try {
      return JSON.parse(content)
    } catch {
      throw new Error(
        `Groq returned non-JSON content: ${content.slice(0, 500)}`
      )
    }
  }
}
