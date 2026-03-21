import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { YAML } from "bun"

export type AICodexOAuthConfig = {
  issuer?: string
  clientId?: string
  audience?: string
  scopes?: string[]
  authorizePath?: string
  tokenPath?: string
  revokePath?: string
  redirectUri?: string
  storagePath?: string
  refreshSkewMs?: number
}

export type AIProviderConfigEntry = {
  serviceName: string
  apiKey?: string
  model: string
  priority: number
  dailyBudgetRequests: number
  dailyBudgetTokens: number
  maxConcurrency: number
  maxRequestsPerMinute: number
  authProfile?: string
  baseUrl?: string
  oauth?: AICodexOAuthConfig
  enabled?: boolean
}

type AIRouterSettings = {
  sliceMinutes: number
  sliceBurstFactor: number
  externalRemainingLowThreshold: number
  cooldownRateLimitSeconds: number
  cooldownProviderErrorSeconds: number
  blockPaymentRequiredSeconds: number
}

type AIProviderConfigFile = {
  router: AIRouterSettings
  providers: AIProviderConfigEntry[]
}

let cachePath: string | undefined
let cacheRaw: string | undefined
let cacheParsed: AIProviderConfigFile | undefined

const readAIProviderConfigFile = (): AIProviderConfigFile => {
  const absolutePath = resolve(process.cwd(), "ai-providers.yaml")
  let rawFile = ""
  try {
    rawFile = readFileSync(absolutePath, "utf8")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Unable to read AI provider YAML config at project root (${absolutePath}): ${message}`
    )
  }

  if (cacheParsed && cachePath === absolutePath && cacheRaw === rawFile) {
    return cacheParsed
  }

  let parsed: AIProviderConfigFile
  try {
    parsed = YAML.parse(rawFile) as AIProviderConfigFile
  } catch {
    throw new Error("AI provider YAML config must be valid YAML")
  }

  cachePath = absolutePath
  cacheRaw = rawFile
  cacheParsed = parsed
  return cacheParsed
}

export const readAIProviderConfig = (): AIProviderConfigEntry[] => {
  return readAIProviderConfigFile().providers
}

export const readAIRouterSettings = (): AIRouterSettings => {
  return readAIProviderConfigFile().router
}

export const findAIProviderByService = (
  serviceName: string
): AIProviderConfigEntry | undefined => {
  const expected = serviceName.toLowerCase()
  return readAIProviderConfig().find(
    (p) => p.serviceName?.toLowerCase() === expected && p.enabled !== false
  )
}
