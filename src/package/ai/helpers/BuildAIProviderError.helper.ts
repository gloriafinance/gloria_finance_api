import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError"

export const buildAIProviderError = (params: {
  provider: string
  status?: number
  message?: string
}): AIProviderError => {
  const provider = params.provider
  const status = params.status
  const message = params.message ?? "Unexpected provider error"
  const lower = message.toLowerCase()

  if (
    status === 402 ||
    lower.includes("payment required") ||
    lower.includes("billing") ||
    lower.includes("credits")
  ) {
    return new AIProviderError(
      provider,
      status,
      AIProviderErrorCode.LIMIT_EXCEEDED,
      "Billing/cuota requerida para este proveedor"
    )
  }

  if (
    status === 429 ||
    status === 427 ||
    lower.includes("rate limit") ||
    lower.includes("quota")
  ) {
    return new AIProviderError(
      provider,
      status,
      AIProviderErrorCode.LIMIT_EXCEEDED,
      "Se supero el limite (free tier/rate limit/quota)"
    )
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("invalid api key") ||
    lower.includes("authentication")
  ) {
    return new AIProviderError(
      provider,
      status,
      AIProviderErrorCode.AUTH_ERROR,
      "Credenciales/API key invalidas o sin permisos"
    )
  }

  if (
    lower.includes("missing") ||
    lower.includes("environment variable") ||
    lower.includes("not configured")
  ) {
    return new AIProviderError(
      provider,
      status,
      AIProviderErrorCode.CONFIG_ERROR,
      "Configuracion de proveedor incompleta o invalida"
    )
  }

  if (
    lower.includes("empty response") ||
    lower.includes("non-json") ||
    lower.includes("invalid json")
  ) {
    return new AIProviderError(
      provider,
      status,
      AIProviderErrorCode.INVALID_RESPONSE,
      message
    )
  }

  return new AIProviderError(
    provider,
    status,
    AIProviderErrorCode.PROVIDER_ERROR,
    message
  )
}
