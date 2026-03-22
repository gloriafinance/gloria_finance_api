import { Logger } from "@/Shared/adapter"
import type { File } from "@/Shared/domain/types/file"
import type { Schema } from "@google/generative-ai"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError"
import { buildAIProviderError } from "@/package/ai/helpers/BuildAIProviderError.helper"
import {
  findAIProviderByService,
  readAIProviderConfig,
} from "@/package/ai/helpers/AIProviderConfig.helper"
import { GeminiVisionService } from "@/package/ai/providers/gemini/GeminiVisionService"

type AIImageProviderName = string

type AIImagesProviderConfig = {
  name: AIImageProviderName
  apiKey: string
  model: string
  service: GeminiVisionService
}

type AIImagesExecuteArgs<T> = {
  systemPrompt: string
  userPrompt: string
  schema: Schema
  files: File[]
  validate: (provider: AIImageProviderName, payload: unknown) => T
}

export class AIImagesService {
  private static instance: AIImagesService

  private readonly logger = Logger(AIImagesService.name)
  private readonly config: AIImagesProviderConfig

  constructor() {
    this.config = this.buildProviderConfig()
  }

  static getInstance(): AIImagesService {
    if (!this.instance) {
      this.instance = new AIImagesService()
    }

    return this.instance
  }

  async execute<T>(args: AIImagesExecuteArgs<T>): Promise<T> {
    return this.executeDirect(args, this.config)
  }

  private async executeDirect<T>(
    args: AIImagesExecuteArgs<T>,
    config: AIImagesProviderConfig
  ): Promise<T> {
    const start = Date.now()

    this.logger.info(
      `AI Images direct provider=${config.name} files=${args.files.length}`
    )

    try {
      this.assertValidFiles(args.files)

      const execution = await config.service.analyze({
        apiKey: config.apiKey,
        model: config.model,
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        schemaResponse: args.schema,
        files: args.files,
      })

      const validated = args.validate(config.name, execution.data)

      this.logger.info(
        `AI Images direct success provider=${config.name} durationMs=${Date.now() - start}`
      )

      return validated
    } catch (error) {
      const mapped =
        error instanceof AIProviderError
          ? error
          : buildAIProviderError({
              provider: config.name,
              message: error instanceof Error ? error.message : String(error),
            })

      this.logger.error(
        `AI Images direct error provider=${config.name} code=${mapped.code} status=${mapped.status} durationMs=${Date.now() - start} message=${mapped.rawMessage}`
      )

      throw mapped
    }
  }

  private buildProviderConfig(): AIImagesProviderConfig {
    try {
      readAIProviderConfig()
    } catch (error) {
      throw new AIProviderError(
        "AIImages",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        error instanceof Error
          ? error.message
          : "Invalid AI provider YAML config"
      )
    }

    const entry = findAIProviderByService("gemini")
    if (!entry) {
      throw new AIProviderError(
        "AIImages",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        "AI images service requires one configured 'gemini' provider."
      )
    }

    const apiKey = entry.apiKey?.trim()
    if (!apiKey) {
      throw new AIProviderError(
        "AIImages",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        "Missing apiKey in AI provider YAML config for service 'gemini'"
      )
    }

    const model = entry.model?.trim()
    if (!model) {
      throw new AIProviderError(
        "AIImages",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        "Missing model in AI provider YAML config for service 'gemini'"
      )
    }

    return {
      name: entry.serviceName,
      apiKey,
      model,
      service: this.resolveProviderService(entry.serviceName),
    }
  }

  private resolveProviderService(serviceName: string): GeminiVisionService {
    serviceName = serviceName.toLowerCase()

    if (serviceName === "gemini") return GeminiVisionService.getInstance()

    throw new AIProviderError(
      "AIImages",
      undefined,
      AIProviderErrorCode.CONFIG_ERROR,
      `Unsupported image AI service '${serviceName}'. AI images service only supports 'gemini'.`
    )
  }

  private assertValidFiles(files: File[]): void {
    if (!Array.isArray(files) || files.length === 0) {
      throw new AIProviderError(
        "AIImages",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        "AI images service requires at least one image file"
      )
    }

    for (const file of files) {
      if (!file?.mimeType?.startsWith("image/")) {
        throw new AIProviderError(
          "AIImages",
          undefined,
          AIProviderErrorCode.CONFIG_ERROR,
          `Unsupported file mime type '${file?.mimeType ?? "unknown"}'. AI images service only supports image/* inputs.`
        )
      }

      if (!file.data || file.data.length === 0) {
        throw new AIProviderError(
          "AIImages",
          undefined,
          AIProviderErrorCode.CONFIG_ERROR,
          `Image file '${file.name}' is empty`
        )
      }
    }
  }
}
