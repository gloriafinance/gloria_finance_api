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
  authProfile?: string
  baseUrl?: string
  oauth?: AICodexOAuthConfig
}

type AIProviderConfigFile = {
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

  if (!parsed || !Array.isArray(parsed.providers)) {
    throw new Error("AI provider YAML config must define a 'providers' array")
  }

  cachePath = absolutePath
  cacheRaw = rawFile
  cacheParsed = parsed
  return cacheParsed
}

export const readAIProviderConfig = (): AIProviderConfigEntry[] => {
  return readAIProviderConfigFile().providers
}

export const findAIProviderByService = (
  serviceName: string
): AIProviderConfigEntry | undefined => {
  const expected = serviceName.toLowerCase()
  const matches = readAIProviderConfig().filter(
    (p) => p.serviceName?.toLowerCase() === expected
  )

  if (matches.length > 1) {
    throw new Error(
      `AI provider YAML config must not define duplicate providers for service '${expected}'`
    )
  }

  return matches[0]
}
