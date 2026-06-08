import { Logger } from "@/Shared/adapter"
import type { Schema } from "@google/generative-ai"
import type { AIExecutionResult, AIRepairInvalidResponseInput, IProxyIAService, } from "@/package/ai/ai.interface"
import { normalizeStructuredSchema } from "@/package/ai/helpers/NormalizeStructuredSchema.helper"
import { buildAIProviderError } from "@/package/ai/helpers/BuildAIProviderError.helper"
import { findAIProviderByService } from "@/package/ai/helpers/AIProviderConfig.helper"
import { CodexOAuthTokenManager } from "@/package/ai/providers/codex/CodexOAuthTokenManager"
import { extractCodexQuotaMeta } from "@/package/ai/providers/codex/helpers/ExtractCodexQuotaMeta.helper"
import { parseCodexResponse } from "@/package/ai/providers/codex/helpers/ParseCodexResponse.helper"
import { buildCodexRepairPrompt } from "@/package/ai/providers/codex/helpers/BuildCodexRepairPrompt.helper"
import { maskCodexSecret } from "@/package/ai/providers/codex/helpers/MaskCodexSecret.helper"
import { extractCodexAccountId } from "@/package/ai/providers/codex/helpers/ExtractCodexAccountId.helper"
import {
  normalizeCodexCompletedResponse
} from "@/package/ai/providers/codex/helpers/NormalizeCodexCompletedResponse.helper"

type CodexProviderResponse = {
  error?: {
    message?: string
    code?: string
  }
  [key: string]: unknown
}

export class CodexAIService implements IProxyIAService {
  private static instance: CodexAIService | null = null
  private readonly logger = Logger(CodexAIService.name)

  constructor(
    private readonly tokenManager = CodexOAuthTokenManager.getInstance()
  ) {}

  static getInstance(): CodexAIService {
    if (!this.instance) {
      this.instance = new CodexAIService()
    }
    return this.instance
  }

  async execute(
    systemPrompt: string,
    userPrompt: string,
    schemaResponse: Schema
  ): Promise<AIExecutionResult> {
    const providerCfg = findAIProviderByService("codex")
    const model = providerCfg?.model
    if (!model) {
      throw buildAIProviderError({
        provider: "CodexAI",
        message: "Missing model in AI provider YAML config for service 'codex'",
      })
    }

    const auth = await this.resolveAuthorization(providerCfg)
    const normalizedSchema = normalizeStructuredSchema(schemaResponse)
    const baseUrl = "https://chatgpt.com/backend-api"

    this.logger.info(
      `Codex execute model=${model} auth=oauth token=${maskCodexSecret(auth.bearerToken)}`
    )

    const response = await this.requestCodexChatGPTBackend({
      baseUrl,
      bearerToken: auth.bearerToken,
      accountId: auth.accountId,
      model,
      systemPrompt,
      userPrompt,
      normalizedSchema,
    })

    if (!response.ok) {
      throw buildAIProviderError({
        provider: "CodexAI",
        status: response.status,
        message: response.message,
      })
    }

    return {
      data: parseCodexResponse(response.payload),
      meta: {
        model,
        ...response.meta,
      },
    }
  }

  async repairInvalidResponse(
    input: AIRepairInvalidResponseInput
  ): Promise<AIExecutionResult> {
    const normalizedSchema = normalizeStructuredSchema(input.schemaResponse)
    return this.execute(
      input.systemPrompt,
      buildCodexRepairPrompt(
        normalizedSchema,
        input.invalidPayload,
        input.reason.rawMessage
      ),
      input.schemaResponse
    )
  }

  private async requestCodexChatGPTBackend(params: {
    baseUrl: string
    bearerToken: string
    accountId?: string
    model: string
    systemPrompt: string
    userPrompt: string
    normalizedSchema: Record<string, unknown>
  }): Promise<{
    ok: boolean
    status: number
    message: string
    payload: CodexProviderResponse
    meta: ReturnType<typeof extractCodexQuotaMeta>
  }> {
    if (!params.accountId) {
      return {
        ok: false,
        status: 401,
        message: "Missing chatgpt account id in OAuth token",
        payload: {},
        meta: {},
      }
    }

    const body: Record<string, unknown> = {
      model: params.model,
      store: false,
      stream: true,
      instructions: params.systemPrompt,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: params.userPrompt }],
        },
      ],
      text: {
        verbosity: "medium",
        format: {
          type: "json_schema",
          name: "codex_response",
          strict: true,
          schema: params.normalizedSchema,
        },
      },
      include: ["reasoning.encrypted_content"],
      tool_choice: "auto",
      parallel_tool_calls: true,
    }

    const response = await fetch(this.resolveCodexBackendUrl(params.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.bearerToken}`,
        "chatgpt-account-id": params.accountId,
        originator: "gloria_finance_api",
        "OpenAI-Beta": "responses=experimental",
        accept: "text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const payload = await this.tryParseJson(response)
      return {
        ok: false,
        status: response.status,
        message: this.extractErrorMessage(
          payload,
          `Codex ChatGPT backend request failed with status ${response.status}`
        ),
        payload,
        meta: extractCodexQuotaMeta(response.headers),
      }
    }

    const payload = await this.parseCodexSSE(response)
    return {
      ok: true,
      status: response.status,
      message: "",
      payload,
      meta: extractCodexQuotaMeta(response.headers),
    }
  }

  private async resolveAuthorization(
    providerCfg?: ReturnType<typeof findAIProviderByService>
  ): Promise<{
    bearerToken: string
    accountId?: string
  }> {
    const authProfile = providerCfg?.authProfile?.trim()

    if (authProfile) {
      const profile = await this.tokenManager.getValidProfile(
        authProfile,
        providerCfg
      )
      return {
        bearerToken: profile.tokenSet.accessToken,
        accountId:
          profile.tokenSet.account?.chatgptAccountId ??
          extractCodexAccountId(profile.tokenSet.accessToken),
      }
    }

    throw buildAIProviderError({
      provider: "CodexAI",
      message:
        "Provider 'codex' requires authProfile in AI provider YAML config",
    })
  }

  private extractErrorMessage(
    payload: CodexProviderResponse,
    fallback: string
  ): string {
    const error = payload?.error
    if (error?.message?.trim()) return error.message
    if (error?.code?.trim()) return error.code
    return fallback
  }

  private resolveBaseUrl(configuredBaseUrl?: string): string {
    const configured = configuredBaseUrl?.trim().replace(/\/+$/g, "")
    if (!configured) {
      throw buildAIProviderError({
        provider: "CodexAI",
        message:
          "Missing baseUrl in AI provider YAML config for service 'codex'",
      })
    }
    return configured
  }

  private resolveCodexBackendUrl(baseUrl: string): string {
    const normalized = baseUrl.replace(/\/+$/g, "")
    if (normalized.endsWith("/codex/responses")) return normalized
    if (normalized.endsWith("/codex")) return `${normalized}/responses`
    return `${normalized}/codex/responses`
  }

  private async tryParseJson(
    response: Response
  ): Promise<CodexProviderResponse> {
    const text = await response.text()
    try {
      return JSON.parse(text) as CodexProviderResponse
    } catch {
      return {}
    }
  }

  private async parseCodexSSE(
    response: Response
  ): Promise<CodexProviderResponse> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("Codex ChatGPT backend returned no response body")
    }

    const decoder = new TextDecoder()
    let buffer = ""
    const streamedOutputItems: Record<string, unknown>[] = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        let separatorIndex = buffer.indexOf("\n\n")

        while (separatorIndex !== -1) {
          const chunk = buffer.slice(0, separatorIndex)
          buffer = buffer.slice(separatorIndex + 2)
          separatorIndex = buffer.indexOf("\n\n")

          const data = chunk
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n")
            .trim()

          if (!data || data === "[DONE]") continue

          const event = JSON.parse(data) as Record<string, unknown>
          const type = typeof event.type === "string" ? event.type : undefined

          if (type === "error") {
            throw new Error(
              typeof event.message === "string"
                ? event.message
                : "Codex backend error"
            )
          }

          if (type === "response.output_item.done") {
            const item = event.item
            if (item && typeof item === "object") {
              streamedOutputItems.push(item as Record<string, unknown>)
            }
            continue
          }

          if (type === "response.failed") {
            const responseError =
              event.response &&
              typeof event.response === "object" &&
              (event.response as Record<string, unknown>).error &&
              typeof (event.response as Record<string, unknown>).error ===
                "object"
                ? ((event.response as Record<string, unknown>).error as Record<
                    string,
                    unknown
                  >)
                : undefined

            throw new Error(
              typeof responseError?.message === "string"
                ? responseError.message
                : "Codex response failed"
            )
          }

          if (
            type === "response.done" ||
            type === "response.completed" ||
            type === "response.incomplete"
          ) {
            const completedResponse =
              event.response && typeof event.response === "object"
                ? (event.response as CodexProviderResponse)
                : {}

            return normalizeCodexCompletedResponse(
              completedResponse,
              streamedOutputItems
            )
          }
        }
      }
    } finally {
      try {
        await reader.cancel()
      } catch {}
      try {
        reader.releaseLock()
      } catch {}
    }

    if (streamedOutputItems.length > 0) {
      return {
        output: streamedOutputItems,
      }
    }

    throw new Error("Codex ChatGPT backend returned no completed response")
  }
}
