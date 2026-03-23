import type { File } from "@/Shared/domain/types/file"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError"
import { AIImagesService } from "@/package/ai/service/AIImagesService"
import { type Schema, SchemaType } from "@google/generative-ai"

export type SupportVisionExtraction = {
  documentType: string
  vendor: string
  amount: string
  currency: string
  documentDate: string
  summary: string
  hints: string[]
}

export class SupportDocumentVisionAgent {
  constructor(private readonly imagesService = AIImagesService.getInstance()) {}

  async execute(
    files: File[],
    question: string
  ): Promise<SupportVisionExtraction> {
    const schema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        documentType: { type: SchemaType.STRING },
        vendor: { type: SchemaType.STRING },
        amount: { type: SchemaType.STRING },
        currency: { type: SchemaType.STRING },
        documentDate: { type: SchemaType.STRING },
        summary: { type: SchemaType.STRING },
        hints: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: [
        "documentType",
        "vendor",
        "amount",
        "currency",
        "documentDate",
        "summary",
        "hints",
      ],
    }

    return this.imagesService.execute({
      systemPrompt: `
You analyze accounting-related images for Gloria Finance.
Return only valid JSON.
Extract only what is visually supported.
      `.trim(),
      userPrompt: `
Question from user: ${question}
Identify the document type and extract useful accounting guidance data.
      `.trim(),
      schema,
      files,
      validate: (provider, payload) => this.validateResponse(provider, payload),
    })
  }

  private validateResponse(
    provider: string,
    payload: unknown
  ): SupportVisionExtraction {
    if (!payload || typeof payload !== "object") {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid image response: payload is not an object"
      )
    }

    const response = payload as Record<string, unknown>
    const requiredKeys = [
      "documentType",
      "vendor",
      "amount",
      "currency",
      "documentDate",
      "summary",
      "hints",
    ]

    if (!this.hasOnlyKeys(response, requiredKeys)) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid image response: unexpected keys"
      )
    }

    for (const key of [
      "documentType",
      "vendor",
      "amount",
      "currency",
      "documentDate",
      "summary",
    ]) {
      if (typeof response[key] !== "string") {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          `Invalid image response: field '${key}' must be string`
        )
      }
    }

    if (
      !Array.isArray(response.hints) ||
      response.hints.some((item) => typeof item !== "string")
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid image response: hints must be string array"
      )
    }

    return response as SupportVisionExtraction
  }

  private hasOnlyKeys(obj: Record<string, unknown>, keys: string[]): boolean {
    const objKeys = Object.keys(obj).sort()
    const expected = [...keys].sort()
    return JSON.stringify(objKeys) === JSON.stringify(expected)
  }
}
