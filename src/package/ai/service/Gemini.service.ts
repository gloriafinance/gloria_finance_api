import { Logger } from "@/Shared/adapter"
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai"
import { buildAIProviderError } from "@/package/ai/helpers/BuildAIProviderError.helper"
import type { AIExecutionResult } from "@/package/ai/ai.interface"
import { findAIProviderByService } from "@/package/ai/helpers/AIProviderConfig.helper"

export class GeminiService {
  private static _instance: GeminiService | null = null

  private logger = Logger(GeminiService.name)

  static getInstance() {
    if (!this._instance) {
      this._instance = new GeminiService()
    }
    return this._instance
  }

  async execute(
    prompt: string,
    schemaResponse: Schema
  ): Promise<AIExecutionResult> {
    const providerCfg = findAIProviderByService("gemini")
    const apiKey = providerCfg?.apiKey
    if (!apiKey) {
      throw buildAIProviderError({
        provider: "Gemini",
        message: "Missing apiKey in AI_PROVIDER_CONFIG for service 'gemini'",
      })
    }

    try {
      const modelName = providerCfg?.model
      if (!modelName) {
        throw buildAIProviderError({
          provider: "Gemini",
          message: "Missing model in AI_PROVIDER_CONFIG for service 'gemini'",
        })
      }

      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schemaResponse,
        },
      })

      this.logger.info("🚀 Enviando datos a Gemini...")

      const result = await model.generateContent(prompt)
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
