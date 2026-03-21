import type { AIExecutionMeta } from "@/package/ai/ai.interface"

const readNumberHeader = (
  headers: Headers,
  name: string
): number | undefined => {
  const raw = headers.get(name)
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

export const extractCodexQuotaMeta = (headers: Headers): AIExecutionMeta => {
  return {
    remainingRequests:
      readNumberHeader(headers, "x-ratelimit-remaining-requests") ??
      readNumberHeader(headers, "ratelimit-remaining-requests"),
    remainingTokens:
      readNumberHeader(headers, "x-ratelimit-remaining-tokens") ??
      readNumberHeader(headers, "ratelimit-remaining-tokens"),
    resetAtUnixMs: (() => {
      const raw =
        headers.get("x-ratelimit-reset-requests") ||
        headers.get("ratelimit-reset-requests")
      const value = Number(raw)
      return Number.isFinite(value) ? value : undefined
    })(),
  }
}
