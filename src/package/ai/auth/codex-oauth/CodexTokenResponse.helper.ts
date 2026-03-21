import { decodeJwt } from "jose"
import type { CodexOAuthTokenSet } from "@/package/ai/auth/codex-oauth/CodexOAuth.types"
import {
  CodexOAuthError,
  CodexOAuthErrorCode,
} from "@/package/ai/auth/codex-oauth/CodexOAuthError"

const parseAccount = (idToken?: string, accessToken?: string) => {
  const token = idToken || accessToken
  if (!token) return undefined

  try {
    const payload = decodeJwt(token)
    const directChatgptAccountId =
      typeof payload["https://api.openai.com/auth.chatgpt_account_id"] ===
      "string"
        ? (payload["https://api.openai.com/auth.chatgpt_account_id"] as string)
        : undefined
    const authObject = payload["https://api.openai.com/auth"]
    const nestedChatgptAccountId =
      authObject && typeof authObject === "object"
        ? (authObject as Record<string, unknown>).chatgpt_account_id
        : undefined

    return {
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
      sub: typeof payload.sub === "string" ? payload.sub : undefined,
      chatgptAccountId:
        directChatgptAccountId ||
        (typeof nestedChatgptAccountId === "string"
          ? nestedChatgptAccountId
          : undefined),
    }
  } catch {
    return undefined
  }
}

export const mapTokenEndpointResponseToTokenSet = (
  payload: Record<string, unknown>,
  options?: {
    previousRefreshToken?: string
    errorCode?: CodexOAuthErrorCode
  }
): CodexOAuthTokenSet => {
  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : undefined
  const refreshToken =
    typeof payload.refresh_token === "string"
      ? payload.refresh_token
      : options?.previousRefreshToken
  const expiresInSeconds = Number(payload.expires_in ?? 0)
  const idToken =
    typeof payload.id_token === "string" ? payload.id_token : undefined

  if (
    !accessToken ||
    !refreshToken ||
    !Number.isFinite(expiresInSeconds) ||
    expiresInSeconds <= 0
  ) {
    throw new CodexOAuthError(
      options?.errorCode ?? CodexOAuthErrorCode.TOKEN_EXCHANGE_FAILED,
      "Token endpoint response missing access_token, refresh_token or expires_in"
    )
  }

  return {
    accessToken,
    refreshToken,
    expiresInSeconds,
    expiresAtUnixMs: Date.now() + expiresInSeconds * 1000,
    scope: typeof payload.scope === "string" ? payload.scope : undefined,
    tokenType:
      typeof payload.token_type === "string" ? payload.token_type : undefined,
    idToken,
    account: parseAccount(idToken, accessToken),
  }
}
