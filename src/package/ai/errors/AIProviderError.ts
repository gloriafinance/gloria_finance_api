export enum AIProviderErrorCode {
  LIMIT_EXCEEDED = "LIMIT_EXCEEDED",
  AUTH_ERROR = "AUTH_ERROR",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  CONFIG_ERROR = "CONFIG_ERROR",
  PROVIDER_ERROR = "PROVIDER_ERROR",
}

export class AIProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number | undefined,
    public readonly code: AIProviderErrorCode,
    public readonly rawMessage: string
  ) {
    super(
      `[${provider}] ${code}: ${rawMessage}${
        status ? ` (status=${status})` : ""
      }`
    )
    this.name = "AIProviderError"
  }
}
