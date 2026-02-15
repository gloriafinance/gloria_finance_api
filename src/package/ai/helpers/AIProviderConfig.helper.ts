type AIProviderConfigEntry = {
  name: string
  serviceName: string
  apiKey: string
  model: string
  priority: number
  dailyBudgetRequests: number
  dailyBudgetTokens: number
  maxConcurrency: number
  maxRequestsPerMinute: number
  enabled?: boolean
}

let cacheRaw: string | undefined
let cacheParsed: AIProviderConfigEntry[] | undefined

const toNumber = (value: unknown): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number value: ${String(value)}`)
  }
  return n
}

const validateEntry = (entry: unknown): AIProviderConfigEntry => {
  if (!entry || typeof entry !== "object") {
    throw new Error("Each AI provider config entry must be an object")
  }

  const e = entry as Record<string, unknown>

  if (typeof e.name !== "string" || !e.name.trim()) {
    throw new Error("AI provider config requires non-empty 'name'")
  }

  if (typeof e.serviceName !== "string" || !e.serviceName.trim()) {
    throw new Error(
      `AI provider '${String(e.name)}' requires non-empty 'serviceName'`
    )
  }

  if (typeof e.apiKey !== "string") {
    throw new Error(`AI provider '${String(e.name)}' requires string 'apiKey'`)
  }

  if (typeof e.model !== "string" || !e.model.trim()) {
    throw new Error(`AI provider '${String(e.name)}' requires non-empty 'model'`)
  }

  return {
    name: e.name.trim().toLowerCase(),
    serviceName: e.serviceName.trim().toLowerCase(),
    apiKey: e.apiKey,
    model: e.model.trim(),
    priority: toNumber(e.priority),
    dailyBudgetRequests: toNumber(e.dailyBudgetRequests),
    dailyBudgetTokens: toNumber(e.dailyBudgetTokens),
    maxConcurrency: toNumber(e.maxConcurrency),
    maxRequestsPerMinute: toNumber(e.maxRequestsPerMinute),
    enabled:
      typeof e.enabled === "boolean"
        ? e.enabled
        : e.enabled === undefined
          ? true
          : String(e.enabled).toLowerCase() !== "false",
  }
}

export const readAIProviderConfig = (): AIProviderConfigEntry[] => {
  const raw = process.env.AI_PROVIDER_CONFIG

  if (!raw) {
    throw new Error("Missing AI_PROVIDER_CONFIG environment variable")
  }

  if (cacheParsed && cacheRaw === raw) {
    return cacheParsed
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("AI_PROVIDER_CONFIG must be valid JSON")
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI_PROVIDER_CONFIG must be a JSON array")
  }

  const providers = parsed.map(validateEntry)
  const names = new Set<string>()
  for (const p of providers) {
    if (names.has(p.name)) {
      throw new Error(`Duplicated provider name in AI_PROVIDER_CONFIG: ${p.name}`)
    }
    names.add(p.name)
  }

  cacheRaw = raw
  cacheParsed = providers
  return providers
}

export const findAIProviderByName = (
  name: string
): AIProviderConfigEntry | undefined => {
  return readAIProviderConfig().find((p) => p.name === name.toLowerCase())
}

export const findAIProviderByService = (
  serviceName: string
): AIProviderConfigEntry | undefined => {
  return readAIProviderConfig().find(
    (p) => p.serviceName === serviceName.toLowerCase() && p.enabled !== false
  )
}
