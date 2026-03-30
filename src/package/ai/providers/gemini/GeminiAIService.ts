import type {
  AIExecutionResult,
  IProxyIAService,
} from "@/package/ai/ai.interface.ts"
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai"
import { Logger } from "@/Shared/adapter"
import { buildAIProviderError } from "../../helpers/BuildAIProviderError.helper"
import {
  type AIProviderConfigEntry,
  findAIProviderByService,
} from "../../helpers/AIProviderConfig.helper.ts"

export class GeminiAIService implements IProxyIAService {
  private static instance: GeminiAIService | null = null
  private readonly logger = Logger(GeminiAIService.name)
  private cfg?: AIProviderConfigEntry

  constructor() {
    this.cfg = findAIProviderByService("gemini")
  }

  static getInstance(): GeminiAIService {
    if (!this.instance) {
      this.instance = new GeminiAIService()
    }
    return this.instance
  }

  async execute(
    systemPrompt: string,
    userPrompt: string,
    schemaResponse: Schema
  ): Promise<AIExecutionResult> {
    const apiKey = this.cfg?.apiKey
    if (!apiKey) {
      throw buildAIProviderError({
        provider: "Gemini",
        message: "Missing apiKey in AI_PROVIDER_CONFIG for service 'gemini'",
      })
    }

    try {
      const modelName = this.cfg?.model
      if (!modelName) {
        throw buildAIProviderError({
          provider: "Gemini",
          message: "Missing model in AI_PROVIDER_CONFIG for service 'gemini'",
        })
      }

      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schemaResponse,
        },
      })

      this.logger.info("🚀 Enviando datos a Gemini...")

      const result = await model.generateContent(userPrompt)
      const response = result.response

      if (!response.candidates || response.candidates.length === 0) {
        this.logger.error("⚠️ La IA no devolvió candidatos. Revisa tu cuota.")
      }

      return {
        data: JSON.parse(response.text()),
        meta: { model: modelName },
      }
    } catch (error: any) {
      this.logger.error("\n❌ ERROR CONECTANDO CON GEMINI:")
      if (error.message) console.error("Mensaje:", error.message)
      if (error.status) console.error("Status Code:", error.status)

      throw buildAIProviderError({
        provider: "Gemini",
        status: error?.status,
        message: error?.message,
      })
    }
  }
}
