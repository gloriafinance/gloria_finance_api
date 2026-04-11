import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError.ts"
import type { DevotionalResponse } from "@/Church/domain"
import { compactText, readFirstString } from "@/Shared/helpers"

const limit = (value: string, max: number): string =>
  value.length > max ? value.slice(0, max).trim() : value

const fallbackPushBodyFromDevotional = (devotional: string): string => {
  const compact = compactText(devotional)
  if (!compact) return ""
  return limit(compact, 120)
}

const normalizeScriptures = (
  rawScriptures: unknown
): Array<{ reference: string; quote: string }> => {
  if (!Array.isArray(rawScriptures)) {
    return []
  }

  const normalized = rawScriptures
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const scripture = item as Record<string, unknown>
      const reference = readFirstString(scripture, ["reference", "ref"])
      const quote = readFirstString(scripture, ["quote", "text"])
      if (!reference || !quote) return null
      return {
        reference: compactText(reference),
        quote: compactText(quote),
      }
    })
    .filter(
      (item): item is { reference: string; quote: string } => item !== null
    )

  if (normalized.length === 0) {
    return []
  }

  if (normalized.length > 3) {
    return normalized.slice(0, 3)
  }

  return normalized
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
  const devotionalRaw = readFirstString(response, [
    "devotional",
    "content",
    "message",
  ])
  if (!devotionalRaw) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: devotional must be a non-empty string"
    )
  }
  const devotional = compactText(devotionalRaw)

  const scriptures = normalizeScriptures(response.scriptures)
  if (scriptures.length < 1 || scriptures.length > 3) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: scriptures must have between 1 and 3 items"
    )
  }

  const push = response.push
  if (!push || typeof push !== "object") {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: push must be an object"
    )
  }

  const pushObj = push as Record<string, unknown>
  const titleRaw =
    readFirstString(response, ["title", "titulo"]) ??
    readFirstString(pushObj, ["push_title", "pushTitle", "title"]) ??
    devotional.slice(0, 60)
  const title = limit(compactText(titleRaw), 60)

  if (!title) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: title must be 1..60 characters"
    )
  }

  const pushTitleRaw =
    readFirstString(pushObj, ["push_title", "pushTitle", "title"]) ?? title
  const pushBodyRaw =
    readFirstString(pushObj, ["push_body", "pushBody", "body"]) ??
    fallbackPushBodyFromDevotional(devotional)

  const pushTitle = limit(compactText(pushTitleRaw), 40)
  const pushBody = limit(compactText(pushBodyRaw), 120)

  if (!pushTitle) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: push_title must be 1..40 characters"
    )
  }

  if (!pushBody) {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid devotional response: push_body must be 1..120 characters"
    )
  }

  const normalized: DevotionalResponse = {
    title,
    devotional,
    scriptures,
    push: {
      push_title: pushTitle,
      push_body: pushBody,
    },
  }

  return normalized
}
