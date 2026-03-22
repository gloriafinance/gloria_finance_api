import { Logger } from "@/Shared/adapter"
import type { Schema } from "@google/generative-ai"
import type { IProxyIAService } from "@/package/ai/ai.interface"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError"
import { buildAIProviderError } from "@/package/ai/helpers/BuildAIProviderError.helper"
import {
  findAIProviderByService,
  readAIProviderConfig,
} from "@/package/ai/helpers/AIProviderConfig.helper"
import { CodexAIService } from "@/package/ai/providers/codex/CodexAI.service"

type AIProviderName = string

type ProviderConfig = {
  name: AIProviderName
  service: IProxyIAService
}

type AITextExecuteArgs<T> = {
  systemPrompt: string
  userPrompt: string
  schema: Schema
  validate: (provider: AIProviderName, payload: unknown) => T
}

export class AITextService {
  private static instance: AITextService

  private readonly logger = Logger(AITextService.name)
  private readonly config: ProviderConfig

  constructor() {
    this.config = this.buildProviderConfig()
  }

  static getInstance(): AITextService {
    if (!this.instance) {
      this.instance = new AITextService()
    }

    return this.instance
  }

  async execute<T>(args: AITextExecuteArgs<T>): Promise<T> {
    return this.executeDirect(args, this.config)
  }

  private async executeDirect<T>(
    args: AITextExecuteArgs<T>,
    config: ProviderConfig
  ): Promise<T> {
    const start = Date.now()
    let providerPayload: unknown | undefined

    this.logger.info(`AI Text direct provider=${config.name}`)

    try {
      const execution = await config.service.execute(
        args.systemPrompt,
        args.userPrompt,
        args.schema
      )
      providerPayload = execution.data

      const validated = args.validate(config.name, execution.data)

      this.logger.info(
        `AI Text direct success provider=${config.name} durationMs=${Date.now() - start}`
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
          `AI Text repair pass provider=${config.name} reason=${mapped.rawMessage}`
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
            `AI Text direct success provider=${config.name} via=repair_pass durationMs=${Date.now() - start}`
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
        `AI Text direct error provider=${config.name} code=${mapped.code} status=${mapped.status} durationMs=${Date.now() - start} message=${mapped.rawMessage}`
      )

      throw mapped
    }
  }

  private buildProviderConfig(): ProviderConfig {
    try {
      readAIProviderConfig()
    } catch (error) {
      throw new AIProviderError(
        "AIText",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        error instanceof Error
          ? error.message
          : "Invalid AI provider YAML config"
      )
    }

    const entry = findAIProviderByService("codex")
    if (!entry) {
      throw new AIProviderError(
        "AIText",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        "AI text service requires one configured 'codex' provider. Gemini is reserved for direct image-analysis agents."
      )
    }

    return {
      name: entry.serviceName,
      service: this.resolveProviderService(entry.serviceName),
    }
  }

  private resolveProviderService(serviceName: string): IProxyIAService {
    serviceName = serviceName.toLowerCase()

    if (serviceName === "codex") return CodexAIService.getInstance()

    throw new AIProviderError(
      "AIText",
      undefined,
      AIProviderErrorCode.CONFIG_ERROR,
      `Unsupported text AI service '${serviceName}'. AI text service only supports 'codex'; use Gemini directly for image-analysis agents.`
    )
  }
}
