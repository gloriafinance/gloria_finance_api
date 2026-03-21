export type CodexOAuthAccount = {
  email?: string
  name?: string
  chatgptAccountId?: string
  sub?: string
}

export type CodexOAuthTokenSet = {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
  expiresAtUnixMs: number
  scope?: string
  tokenType?: string
  idToken?: string
  account?: CodexOAuthAccount
}

export type CodexOAuthStoredProfile = {
  provider: "openai-codex"
  profileId: string
  createdAtUnixMs: number
  updatedAtUnixMs: number
  tokenSet: CodexOAuthTokenSet
}

export type CodexAuthorizationSession = {
  codeVerifier: string
  codeChallenge: string
  state: string
  authorizationUrl: string
  redirectUri: string
}

export type CodexDeviceCodeSession = {
  verificationUrl: string
  userCode: string
  deviceAuthId: string
  intervalSeconds: number
  redirectUri: string
  clientId: string
  issuer: string
}

export type CodexOAuthProfileStatus = {
  exists: boolean
  isExpired: boolean
  isExpiringSoon: boolean
  expiresAtUnixMs?: number
  account?: CodexOAuthAccount
}
