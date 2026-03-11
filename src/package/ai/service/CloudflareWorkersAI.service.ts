import { Logger } from "@/Shared/adapter"
import type { Schema } from "@google/generative-ai"
import type {
  AIRepairInvalidResponseInput,
  AIExecutionMeta,
  AIExecutionResult,
  IProxyIAService,
} from "@/package/ai/ai.interface"
import { normalizeStructuredSchema } from "@/package/ai/helpers/NormalizeStructuredSchema.helper"
import { buildAIProviderError } from "@/package/ai/helpers/BuildAIProviderError.helper"
import { findAIProviderByService } from "@/package/ai/helpers/AIProviderConfig.helper"

type CloudflareChoice = {
  message?: {
    content?: string
  }
}

type CloudflareResponse = {
  error?: {
    message?: string
  }
  choices?: CloudflareChoice[]
  [key: string]: unknown
}

export class CloudflareWorkersAIService implements IProxyIAService {
  private static _instance: CloudflareWorkersAIService | null = null

  private logger = Logger(CloudflareWorkersAIService.name)

  static getInstance() {
    if (!this._instance) {
      this._instance = new CloudflareWorkersAIService()
    }
    return this._instance
  }

  async execute(
    systemPrompt: string,
    userPrompt: string,
    schemaResponse: Schema
  ): Promise<AIExecutionResult> {
    const providerCfg = findAIProviderByService("cloudflare")
    const configuredApiKey = providerCfg?.apiKey
    if (!configuredApiKey) {
      throw buildAIProviderError({
        provider: "CloudflareWorkersAI",
        message:
          "Missing apiKey in AI provider YAML config for service 'cloudflare'",
      })
    }

    const { accountId, apiToken } =
      this.extractCloudflareCredentials(configuredApiKey)

    const model = providerCfg?.model
    if (!model) {
      throw buildAIProviderError({
        provider: "CloudflareWorkersAI",
        message:
          "Missing model in AI provider YAML config for service 'cloudflare'",
      })
    }

    const normalizedSchema = normalizeStructuredSchema(schemaResponse)
    const generationConfig = {
      temperature: 0.2,
      top_p: 0.9,
    }

    this.logger.info(`🚀 Enviando datos a Cloudflare Workers AI (${model})...`)

    const firstAttempt = await this.requestCloudflare(apiToken, accountId, {
      model,
      ...generationConfig,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
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
      this.logger.debug(
        `⚠️ Cloudflare structured output falló, reintentando sin response_format. status=${firstAttempt.status} payload=${firstAttempt.payloadText}`
      )

      const fallbackPrompt = `${userPrompt}\n\nResponde SOLO con JSON válido y sin texto adicional.`

      const secondAttempt = await this.requestCloudflare(apiToken, accountId, {
        model,
        ...generationConfig,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: fallbackPrompt },
        ],
      })

      if (!secondAttempt.ok) {
        this.logger.error(
          `❌ ERROR CONECTANDO CON CLOUDFLARE WORKERS AI: ${secondAttempt.message} | status=${secondAttempt.status} ${secondAttempt.statusText} | payload=${secondAttempt.payloadText}`
        )
        throw buildAIProviderError({
          provider: "CloudflareWorkersAI",
          status: secondAttempt.status,
          message: secondAttempt.message,
        })
      }

      return {
        data: this.parseResponseContent(secondAttempt.payload),
        meta: {
          model,
          ...secondAttempt.meta,
        },
      }
    }

    return {
      data: this.parseResponseContent(firstAttempt.payload),
      meta: {
        model,
        ...firstAttempt.meta,
      },
    }
  }

  async repairInvalidResponse(
    input: AIRepairInvalidResponseInput
  ): Promise<AIExecutionResult> {
    const normalizedSchema = normalizeStructuredSchema(input.schemaResponse)
    return this.execute(
      input.systemPrompt,
      this.buildRepairPrompt(
        normalizedSchema,
        input.invalidPayload,
        input.reason.rawMessage
      ),
      input.schemaResponse
    )
  }

  private async requestCloudflare(
    apiToken: string,
    accountId: string,
    body: Record<string, unknown>
  ): Promise<{
    ok: boolean
    status: number
    statusText: string
    message: string
    payloadText: string
    payload: CloudflareResponse
    meta: AIExecutionMeta
  }> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )

    const raw = await response.text()
    let payload: CloudflareResponse = {}

    try {
      payload = JSON.parse(raw) as CloudflareResponse
    } catch {
      payload = {}
    }

    const message =
      payload?.error?.message ??
      `Cloudflare Workers AI request failed with status ${response.status}`

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

  private extractCloudflareCredentials(apiKey: string): {
    accountId: string
    apiToken: string
  } {
    const separatorIndex = apiKey.indexOf(":")
    if (separatorIndex > 0 && separatorIndex < apiKey.length - 1) {
      return {
        accountId: apiKey.slice(0, separatorIndex),
        apiToken: apiKey.slice(separatorIndex + 1),
      }
    }

    // Compatibilidad solicitada: si no viene compuesto, usa el mismo valor.
    return { accountId: apiKey, apiToken: apiKey }
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

  private parseResponseContent(payload: CloudflareResponse): unknown {
    const rawContent = payload.choices?.[0]?.message?.content
    if (rawContent === undefined || rawContent === null) {
      throw new Error("Cloudflare Workers AI returned an empty response")
    }

    const content = this.normalizeMessageContent(rawContent)

    try {
      return JSON.parse(content)
    } catch {
      throw new Error(
        `Cloudflare Workers AI returned non-JSON content: ${content.slice(0, 500)}`
      )
    }
  }

  private normalizeMessageContent(content: unknown): string {
    if (typeof content === "string") return content

    if (Array.isArray(content)) {
      const joined = content
        .map((item) => {
          if (typeof item === "string") return item
          if (
            item &&
            typeof item === "object" &&
            "text" in (item as Record<string, unknown>) &&
            typeof (item as Record<string, unknown>).text === "string"
          ) {
            return (item as Record<string, unknown>).text as string
          }
          return JSON.stringify(item)
        })
        .join("")

      if (joined.trim()) return joined
    }

    if (typeof content === "object") {
      const maybeText = (content as Record<string, unknown>).text
      if (typeof maybeText === "string" && maybeText.trim()) {
        return maybeText
      }

      return JSON.stringify(content)
    }

    return String(content)
  }

  private buildRepairPrompt(
    normalizedSchema: Record<string, unknown>,
    invalidPayload: unknown,
    reason: string
  ): string {
    const serializedPayload =
      typeof invalidPayload === "string"
        ? invalidPayload
        : JSON.stringify(invalidPayload, null, 2)
    const serializedSchema = JSON.stringify(normalizedSchema, null, 2)

    return [
      "TAREA: reparar JSON invalido.",
      "Responde UNICAMENTE con un JSON valido, sin markdown ni texto adicional.",
      "NO reescribas desde cero: conserva el sentido del contenido existente y corrige solo formato/estructura/longitudes.",
      "",
      "Debes cumplir EXACTAMENTE este JSON schema:",
      serializedSchema,
      "",
      `Motivo de validacion fallida: ${reason}`,
      "JSON a corregir:",
      serializedPayload,
    ].join("\n")
  }
}
