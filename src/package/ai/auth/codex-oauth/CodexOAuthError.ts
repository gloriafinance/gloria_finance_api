export enum CodexOAuthErrorCode {
  INVALID_AUTH_CODE = "INVALID_AUTH_CODE",
  TOKEN_EXCHANGE_FAILED = "TOKEN_EXCHANGE_FAILED",
  REFRESH_FAILED = "REFRESH_FAILED",
  MISSING_PROFILE = "MISSING_PROFILE",
  NO_VALID_CREDENTIALS = "NO_VALID_CREDENTIALS",
  CORRUPTED_STORAGE = "CORRUPTED_STORAGE",
  MISCONFIGURED_PROVIDER = "MISCONFIGURED_PROVIDER",
}

export class CodexOAuthError extends Error {
  constructor(
    public readonly code: CodexOAuthErrorCode,
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message)
    this.name = "CodexOAuthError"
  }
}
