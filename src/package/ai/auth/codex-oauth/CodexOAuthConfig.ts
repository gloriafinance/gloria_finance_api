import { resolve } from "node:path"
import type { AIProviderConfigEntry } from "@/package/ai/helpers/AIProviderConfig.helper"
import {
  CodexOAuthError,
  CodexOAuthErrorCode,
} from "@/package/ai/auth/codex-oauth/CodexOAuthError"

export type ResolvedCodexOAuthConfig = {
  providerId: "openai-codex"
  issuer: string
  clientId: string
  authorizeUrl: string
  tokenUrl: string
  revokeUrl?: string
  redirectUri: string
  scopes: string[]
  storagePath: string
  refreshSkewMs: number
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/g, "")

export const resolveCodexOAuthConfig = (
  providerCfg?: AIProviderConfigEntry
): ResolvedCodexOAuthConfig => {
  const oauth = providerCfg?.oauth
  const issuer = "https://auth.openai.com"
  const clientId = oauth?.clientId?.trim()
  const authorizePath = "/oauth/authorize"
  const tokenPath = "/oauth/token"
  const revokePath = oauth?.revokePath?.trim()
  const redirectUri = "urn:ietf:wg:oauth:2.0:oob"
  const scopes = oauth?.scopes?.filter(Boolean)
  const storagePathConfig = ".codex-oauth"
  const refreshSkewMs = Math.max(Number(oauth?.refreshSkewMs ?? 300000), 0)

  if (!issuer) {
    throw new CodexOAuthError(
      CodexOAuthErrorCode.MISCONFIGURED_PROVIDER,
      "Missing OAuth issuer for provider 'codex'"
    )
  }

  if (!clientId) {
    throw new CodexOAuthError(
      CodexOAuthErrorCode.MISCONFIGURED_PROVIDER,
      "Missing OAuth clientId for provider 'codex'"
    )
  }

  if (!redirectUri) {
    throw new CodexOAuthError(
      CodexOAuthErrorCode.MISCONFIGURED_PROVIDER,
      "Missing OAuth redirectUri for provider 'codex'"
    )
  }

  if (!authorizePath) {
    throw new CodexOAuthError(
      CodexOAuthErrorCode.MISCONFIGURED_PROVIDER,
      "Missing OAuth authorizePath for provider 'codex'"
    )
  }

  if (!tokenPath) {
    throw new CodexOAuthError(
      CodexOAuthErrorCode.MISCONFIGURED_PROVIDER,
      "Missing OAuth tokenPath for provider 'codex'"
    )
  }

  if (!scopes || scopes.length === 0) {
    throw new CodexOAuthError(
      CodexOAuthErrorCode.MISCONFIGURED_PROVIDER,
      "Missing OAuth scopes for provider 'codex'"
    )
  }

  if (!storagePathConfig) {
    throw new CodexOAuthError(
      CodexOAuthErrorCode.MISCONFIGURED_PROVIDER,
      "Missing OAuth storagePath for provider 'codex'"
    )
  }

  const normalizedIssuer = trimTrailingSlash(issuer)
  const storagePath = resolve(process.cwd(), storagePathConfig)

  return {
    providerId: "openai-codex",
    issuer: normalizedIssuer,
    clientId,
    authorizeUrl: `${normalizedIssuer}${authorizePath}`,
    tokenUrl: `${normalizedIssuer}${tokenPath}`,
    revokeUrl: revokePath ? `${normalizedIssuer}${revokePath}` : undefined,
    redirectUri,
    scopes,
    storagePath,
    refreshSkewMs,
  }
}
