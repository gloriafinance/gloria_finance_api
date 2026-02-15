import { AIProviderError, AIProviderErrorCode, } from "@/package/ai/errors/AIProviderError.ts"
import type { DevotionalResponse } from "@/Church/domain"

const hasOnlyKeys = (obj: Record<string, unknown>, keys: string[]): boolean => {
  const objKeys = Object.keys(obj).sort()
  const expected = [...keys].sort()
  return JSON.stringify(objKeys) === JSON.stringify(expected)
}

export const validateDevotionalResponse = (
  provider: string,
  payload: unknown
): DevotionalResponse => {
  if (!payload || typeof payload !== "object") {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: payload is not an object"
    )
  }

  const response = payload as Record<string, unknown>

  if (!hasOnlyKeys(response, ["title", "devotional", "scriptures", "push"])) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: unexpected top-level keys"
    )
  }

  const title = response.title
  const devotional = response.devotional
  const scriptures = response.scriptures
  const push = response.push

  if (typeof title !== "string" || title.length === 0 || title.length > 60) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: title must be 1..60 characters"
    )
  }

  if (typeof devotional !== "string" || devotional.length === 0) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: devotional must be a non-empty string"
    )
  }

  if (
    !Array.isArray(scriptures) ||
    scriptures.length < 1 ||
    scriptures.length > 3
  ) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: scriptures must have between 1 and 3 items"
    )
  }

  for (const item of scriptures) {
    if (!item || typeof item !== "object") {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid devotional response: scripture item must be an object"
      )
    }

    const scripture = item as Record<string, unknown>
    if (!hasOnlyKeys(scripture, ["reference", "quote"])) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid devotional response: scripture item has unexpected keys"
      )
    }

    if (
      typeof scripture.reference !== "string" ||
      typeof scripture.quote !== "string" ||
      !scripture.reference.trim() ||
      !scripture.quote.trim()
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid devotional response: scripture fields must be non-empty strings"
      )
    }
  }

  if (!push || typeof push !== "object") {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: push must be an object"
    )
  }

  const pushObj = push as Record<string, unknown>
  if (!hasOnlyKeys(pushObj, ["push_title", "push_body"])) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: push has unexpected keys"
    )
  }

  if (
    typeof pushObj.push_title !== "string" ||
    pushObj.push_title.length === 0 ||
    pushObj.push_title.length > 40
  ) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: push_title must be 1..40 characters"
    )
  }

  if (
    typeof pushObj.push_body !== "string" ||
    pushObj.push_body.length === 0 ||
    pushObj.push_body.length > 120
  ) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: push_body must be 1..120 characters"
    )
  }

  return response as unknown as DevotionalResponse
}
