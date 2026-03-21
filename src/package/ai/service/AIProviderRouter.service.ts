import { Logger } from "@/Shared/adapter"
import type { Schema } from "@google/generative-ai"
import type { IProxyIAService } from "@/package/ai/ai.interface"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError"
import { buildAIProviderError } from "@/package/ai/helpers/BuildAIProviderError.helper"
import { readAIProviderConfig } from "@/package/ai/helpers/AIProviderConfig.helper"
import { GeminiAIService } from "@/package/ai/providers/gemini/GeminiAI.service"
import { CodexAIService } from "@/package/ai/providers/codex/CodexAI.service"

type AIProviderName = string

type ProviderConfig = {
  name: AIProviderName
  service: IProxyIAService
  priority: number
}

type RouterExecuteArgs<T> = {
  systemPrompt: string
  userPrompt: string
  schema: Schema
  validate: (provider: AIProviderName, payload: unknown) => T
}

export class AIProviderRouterService {
  private static instance: AIProviderRouterService

  private readonly logger = Logger(AIProviderRouterService.name)
  private readonly configs: ProviderConfig[]

  constructor() {
    this.configs = this.buildProviderConfigs()
  }

  static getInstance(): AIProviderRouterService {
    if (!this.instance) {
      this.instance = new AIProviderRouterService()
    }

    return this.instance
  }

  async execute<T>(args: RouterExecuteArgs<T>): Promise<T> {
    if (this.configs.length === 0) {
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        "AI provider YAML config has no enabled providers"
      )
    }

    const orderedConfigs = [...this.configs].sort(
      (a, b) => b.priority - a.priority
    )
    let lastError: Error | undefined

    for (const config of orderedConfigs) {
      try {
        return await this.executeDirect(args, config)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    throw (
      lastError ??
      new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.PROVIDER_ERROR,
        "No provider completed request"
      )
    )
  }

  private async executeDirect<T>(
    args: RouterExecuteArgs<T>,
    config: ProviderConfig
  ): Promise<T> {
    const start = Date.now()
    let providerPayload: unknown | undefined

    this.logger.info(`AI Router direct provider=${config.name}`)

    try {
      const execution = await config.service.execute(
        args.systemPrompt,
        args.userPrompt,
        args.schema
      )
      providerPayload = execution.data

      const validated = args.validate(config.name, execution.data)

      this.logger.info(
        `AI Router direct success provider=${config.name} durationMs=${Date.now() - start}`
      )

      return validated
    } catch (error) {
      let mapped =
        error instanceof AIProviderError
          ? error
          : buildAIProviderError({
              provider: config.name,
              message: error instanceof Error ? error.message : String(error),
            })

      if (
        mapped.code === AIProviderErrorCode.INVALID_RESPONSE &&
        providerPayload !== undefined &&
        config.service.repairInvalidResponse
      ) {
        this.logger.info(
          `AI Router direct repair pass provider=${config.name} reason=${mapped.rawMessage}`
        )

        try {
          const repairedExecution = await config.service.repairInvalidResponse({
            systemPrompt: args.systemPrompt,
            userPrompt: args.userPrompt,
            schemaResponse: args.schema,
            invalidPayload: providerPayload,
            reason: mapped,
          })

          const repairedValidated = args.validate(
            config.name,
            repairedExecution.data
          )

          this.logger.info(
            `AI Router direct success provider=${config.name} via=repair_pass durationMs=${Date.now() - start}`
          )

          return repairedValidated
        } catch (repairError) {
          mapped =
            repairError instanceof AIProviderError
              ? repairError
              : buildAIProviderError({
                  provider: config.name,
                  message:
                    repairError instanceof Error
                      ? repairError.message
                      : String(repairError),
                })
        }
      }

      this.logger.error(
        `AI Router direct error provider=${config.name} code=${mapped.code} status=${mapped.status} durationMs=${Date.now() - start} message=${mapped.rawMessage}`
      )

      throw mapped
    }
  }

  private buildProviderConfigs(): ProviderConfig[] {
    let envProviders
    try {
      envProviders = readAIProviderConfig()
    } catch (error) {
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        error instanceof Error
          ? error.message
          : "Invalid AI provider YAML config"
      )
    }

    const enabled = envProviders.filter((p) => p.enabled !== false)
    if (enabled.length === 0) {
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        "AI provider YAML config has no enabled providers"
      )
    }

    return enabled.map((entry) => ({
      name: entry.serviceName,
      service: this.resolveProviderService(entry.serviceName),
      priority: entry.priority,
    }))
  }

  private resolveProviderService(serviceId: string): IProxyIAService {
    const serviceName = serviceId.toLowerCase()

    if (serviceName === "gemini") return GeminiAIService.getInstance()
    if (serviceName === "codex") return CodexAIService.getInstance()

    throw new AIProviderError(
      "Router",
      undefined,
      AIProviderErrorCode.CONFIG_ERROR,
      `Unsupported service '${serviceName}' in AI provider YAML config. Allowed: gemini|codex`
    )
  }
}
