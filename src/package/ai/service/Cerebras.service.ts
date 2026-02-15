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

type CerebrasChoice = {
  message?: {
    content?: string
  }
}

type CerebrasResponse = {
  error?: {
    message?: string
  }
  choices?: CerebrasChoice[]
  [key: string]: unknown
}

export class CerebrasService implements IProxyIAService {
  private static _instance: CerebrasService | null = null

  private logger = Logger(CerebrasService.name)

  static getInstance() {
    if (!this._instance) {
      this._instance = new CerebrasService()
    }
    return this._instance
  }

  async execute(
    prompt: string,
    schemaResponse: Schema
  ): Promise<AIExecutionResult> {
    const providerCfg = findAIProviderByService("cerebras")
    const apiKey = providerCfg?.apiKey
    if (!apiKey) {
      throw buildAIProviderError({
        provider: "Cerebras",
        message: "Missing apiKey in AI_PROVIDER_CONFIG for service 'cerebras'",
      })
    }

    const model = providerCfg?.model
    if (!model) {
      throw buildAIProviderError({
        provider: "Cerebras",
        message: "Missing model in AI_PROVIDER_CONFIG for service 'cerebras'",
      })
    }
    const normalizedSchema = normalizeStructuredSchema(schemaResponse)

    this.logger.info(`🚀 Enviando datos a Cerebras (${model})...`)

    const request = await this.requestCerebras(apiKey, {
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
        `❌ ERROR CONECTANDO CON CEREBRAS: ${request.message} | status=${request.status} ${request.statusText} | payload=${request.payloadText}`
      )
      throw buildAIProviderError({
        provider: "Cerebras",
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

  private async requestCerebras(
    apiKey: string,
    body: Record<string, unknown>
  ): Promise<{
    ok: boolean
    status: number
    statusText: string
    message: string
    payloadText: string
    payload: CerebrasResponse
    meta: AIExecutionMeta
  }> {
    const response = await fetch(
      "https://api.cerebras.ai/v1/chat/completions",
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
    let payload: CerebrasResponse = {}

    try {
      payload = JSON.parse(raw) as CerebrasResponse
    } catch {
      payload = {}
    }

    const message =
      payload?.error?.message ??
      `Cerebras request failed with status ${response.status}`

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
      headers.get("x-ratelimit-remaining-requests")
    )
    const remainingTokens = this.toNumber(
      headers.get("x-ratelimit-remaining-tokens")
    )
    const resetAtUnixMs = this.parseResetHeader(
      headers.get("x-ratelimit-reset-requests")
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

  private parseContent(payload: CerebrasResponse): unknown {
    const content = payload.choices?.[0]?.message?.content
    if (!content) {
      throw new Error("Cerebras returned an empty response")
    }

    try {
      return JSON.parse(content)
    } catch {
      throw new Error(
        `Cerebras returned non-JSON content: ${content.slice(0, 500)}`
      )
    }
  }
}
