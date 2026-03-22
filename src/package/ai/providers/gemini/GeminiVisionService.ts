import { Logger } from "@/Shared/adapter"
import type { File } from "@/Shared/domain/types/file"
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai"
import type { AIExecutionResult } from "@/package/ai/ai.interface"
import { buildAIProviderError } from "@/package/ai/helpers/BuildAIProviderError.helper"

type GeminiVisionAnalyzeInput = {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  schemaResponse: Schema
  files: File[]
}

type GeminiInlineDataPart = {
  inlineData: {
    mimeType: string
    data: string
  }
}

type GeminiTextPart = {
  text: string
}

export class GeminiVisionService {
  private static instance: GeminiVisionService | null = null

  private readonly logger = Logger(GeminiVisionService.name)

  static getInstance(): GeminiVisionService {
    if (!this.instance) {
      this.instance = new GeminiVisionService()
    }

    return this.instance
  }

  async analyze(input: GeminiVisionAnalyzeInput): Promise<AIExecutionResult> {
    try {
      const genAI = new GoogleGenerativeAI(input.apiKey)
      const model = genAI.getGenerativeModel({
        model: input.model,
        systemInstruction: input.systemPrompt,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: input.schemaResponse,
        },
      })

      this.logger.info(
        `Gemini vision analyze model=${input.model} files=${input.files.length}`
      )

      const result = await model.generateContent(
        this.buildVisionContent(input.userPrompt, input.files)
      )
      const response = result.response

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("Gemini returned no candidates for image analysis")
      }

      return {
        data: JSON.parse(response.text()),
        meta: { model: input.model },
      }
    } catch (error: any) {
      this.logger.error(
        `Gemini vision error status=${error?.status} message=${error?.message}`
      )

      throw buildAIProviderError({
        provider: "GeminiVision",
        status: error?.status,
        message: error?.message,
      })
    }
  }

  private buildVisionContent(
    userPrompt: string,
    files: File[]
  ): Array<GeminiTextPart | GeminiInlineDataPart> {
    const prompt = userPrompt.trim()
    const content: Array<GeminiTextPart | GeminiInlineDataPart> = []

    if (prompt) {
      content.push({ text: prompt })
    }

    for (const file of files) {
      content.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data.toString("base64"),
        },
      })
    }

    return content
  }
}
