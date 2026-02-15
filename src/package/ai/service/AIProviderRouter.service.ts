import { Logger } from "@/Shared/adapter"
import type { Schema } from "@google/generative-ai"
import type {
  AIExecutionMeta,
  IProxyIAService,
} from "@/package/ai/ai.interface"
import Redis from "ioredis"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError"
import { buildAIProviderError } from "@/package/ai/helpers/BuildAIProviderError.helper"
import { readAIProviderConfig } from "@/package/ai/helpers/AIProviderConfig.helper"
import { GeminiService } from "@/package/ai/service/Gemini.service"
import { GroqService } from "@/package/ai/service/Groq.service"
import { CerebrasService } from "@/package/ai/service/Cerebras.service"
import { OpenRouterService } from "@/package/ai/service/OpenRouter.service"

type AIProviderName = string

type ProviderHealthState = {
  success: number
  failures: number
  invalidResponses: number
  rateLimited: number
  billingRequired: number
  providerErrors: number
  lastErrorCode?: AIProviderErrorCode
  lastErrorMessage?: string
  updatedAt: number
}

type ProviderExternalQuota = {
  remainingRequests?: number
  remainingTokens?: number
  resetAtUnixMs?: number
  updatedAt: number
}

type ProviderConfig = {
  name: AIProviderName
  service: IProxyIAService
  priority: number
  dailyBudgetRequests: number
  dailyBudgetTokens: number
  maxConcurrency: number
  maxRequestsPerMinute: number
}

type RouterExecuteArgs<T> = {
  prompt: string
  schema: Schema
  validate: (provider: AIProviderName, payload: unknown) => T
}

type ProviderCandidate = {
  provider: AIProviderName
  score: number
  reasons: string[]
  snapshot: {
    healthScore: number
    dailyRemainingRequests: number
    sliceRemainingRequests: number
    minuteRemainingRequests: number
    concurrencyRemaining: number
    dailyRemainingTokens?: number
    externalRemainingRequests?: number
    externalRemainingTokens?: number
  }
}

export class AIProviderRouterService {
  private static instance: AIProviderRouterService

  private readonly logger = Logger(AIProviderRouterService.name)
  private readonly configs: ProviderConfig[]
  private readonly redisClient: Redis

  private readonly cooldownRateLimitSeconds: number
  private readonly cooldownProviderErrorSeconds: number
  private readonly blockPaymentRequiredSeconds: number

  private readonly sliceMinutes: number
  private readonly sliceBurstFactor: number
  private readonly externalRemainingLowThreshold: number

  private readonly reserveOpenRouter: boolean
  private readonly releaseOpenRouterHoursToReset: number
  private readonly releaseOpenRouterPrimaryRemainingThreshold: number

  constructor() {
    this.cooldownRateLimitSeconds = this.requiredNumberEnv(
      "AI_COOLDOWN_RATE_LIMIT_SECONDS"
    )
    this.cooldownProviderErrorSeconds = this.requiredNumberEnv(
      "AI_COOLDOWN_PROVIDER_ERROR_SECONDS"
    )
    this.blockPaymentRequiredSeconds = this.requiredNumberEnv(
      "AI_BLOCK_PAYMENT_REQUIRED_SECONDS"
    )
    this.sliceMinutes = this.requiredNumberEnv("AI_SLICE_MINUTES")
    this.sliceBurstFactor = this.requiredNumberEnv("AI_SLICE_BURST_FACTOR")
    this.externalRemainingLowThreshold = this.requiredNumberEnv(
      "AI_EXTERNAL_REMAINING_LOW_THRESHOLD"
    )
    this.reserveOpenRouter = this.requiredBooleanEnv("AI_RESERVE_OPENROUTER")
    this.releaseOpenRouterHoursToReset = this.requiredNumberEnv(
      "AI_OPENROUTER_RELEASE_HOURS_TO_RESET"
    )
    this.releaseOpenRouterPrimaryRemainingThreshold = this.requiredNumberEnv(
      "AI_OPENROUTER_RELEASE_PRIMARY_REMAINING_THRESHOLD"
    )

    this.redisClient = new Redis({
      host: this.requiredStringEnv("REDIS_HOST"),
      port: this.requiredNumberEnv("REDIS_PORT"),
      username: process.env.REDIS_USER,
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
    this.configs = this.buildProviderConfigs()
  }

  static getInstance(): AIProviderRouterService {
    if (!this.instance) {
      this.instance = new AIProviderRouterService()
    }

    return this.instance
  }

  async execute<T>(args: RouterExecuteArgs<T>): Promise<T> {
    const estimatedTokens = this.estimateTokens(args.prompt)
    const candidates = await this.rankProviders(estimatedTokens)

    if (candidates.length === 0) {
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.LIMIT_EXCEEDED,
        "No hay proveedores con presupuesto/ventana/minuto/concurrencia disponible"
      )
    }

    let attempts = 0
    let lastError: Error | undefined

    for (const candidate of candidates) {
      const config = this.getConfig(candidate.provider)
      if (!config) continue

      const acquired = await this.acquireConcurrencySlot(config)
      if (!acquired) {
        this.logger.info(
          `Proveedor ${candidate.provider} omitido por concurrencia`
        )
        continue
      }

      const start = Date.now()
      let requestSent = false

      try {
        attempts += 1
        this.logger.info(
          `AI Router choose provider=${candidate.provider} score=${candidate.score.toFixed(2)} reasons=${candidate.reasons.join("|")} dailyRem=${candidate.snapshot.dailyRemainingRequests} sliceRem=${candidate.snapshot.sliceRemainingRequests} rpmRem=${candidate.snapshot.minuteRemainingRequests} concRem=${candidate.snapshot.concurrencyRemaining}`
        )

        const execution = await config.service.execute(args.prompt, args.schema)
        requestSent = true

        await this.consumeRequestsBudget(candidate.provider, 1)

        const actualTokens = this.estimateTokens(JSON.stringify(execution.data))
        await this.consumeTokensBudget(candidate.provider, actualTokens)

        if (execution.meta) {
          await this.applyExternalQuota(candidate.provider, execution.meta)
        }

        const validated = args.validate(candidate.provider, execution.data)

        await this.markSuccess(candidate.provider)
        await this.incrementMetric(candidate.provider, "success", 1)
        await this.incrementMetric(candidate.provider, "assigned", 1)
        await this.incrementMetric(
          candidate.provider,
          "latencyMs",
          Date.now() - start
        )

        this.logger.info(
          `AI Router success provider=${candidate.provider} attempts=${attempts} durationMs=${Date.now() - start}`
        )

        return validated
      } catch (error) {
        if (!requestSent) {
          await this.consumeRequestsBudget(candidate.provider, 1)
        }

        const mapped =
          error instanceof AIProviderError
            ? error
            : buildAIProviderError({
                provider: candidate.provider,
                message: error instanceof Error ? error.message : String(error),
              })

        await this.markFailure(candidate.provider, mapped)
        await this.incrementMetric(candidate.provider, "error", 1)

        this.logger.error(
          `AI Router error provider=${candidate.provider} code=${mapped.code} status=${mapped.status} attempts=${attempts} durationMs=${Date.now() - start} message=${mapped.rawMessage}`
        )

        lastError = mapped
      } finally {
        await this.releaseConcurrencySlot(config)
      }
    }

    throw (
      lastError ??
      new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.LIMIT_EXCEEDED,
        "No provider completed request"
      )
    )
  }

  async getDailySummary(date = this.dayKey()): Promise<Record<string, number>> {
    const summary: Record<string, number> = {}

    for (const cfg of this.configs) {
      const assigned = await this.readCounter(
        this.metricKey(date, cfg.name, "assigned")
      )
      const success = await this.readCounter(
        this.metricKey(date, cfg.name, "success")
      )
      const error = await this.readCounter(
        this.metricKey(date, cfg.name, "error")
      )
      const latency = await this.readCounter(
        this.metricKey(date, cfg.name, "latencyMs")
      )
      const consumedRequests = await this.readCounter(
        this.dailyRequestCounterKey(cfg.name, date)
      )
      const consumedTokens = await this.readCounter(
        this.dailyTokenCounterKey(cfg.name, date)
      )

      summary[`${cfg.name}.assigned`] = assigned
      summary[`${cfg.name}.success`] = success
      summary[`${cfg.name}.error`] = error
      summary[`${cfg.name}.avgLatencyMs`] =
        success > 0 ? Math.round(latency / success) : 0
      summary[`${cfg.name}.consumedRequests`] = consumedRequests
      summary[`${cfg.name}.consumedTokens`] = consumedTokens
    }

    return summary
  }

  private buildProviderConfigs(): ProviderConfig[] {
    let envProviders
    try {
      envProviders = readAIProviderConfig()
    } catch (error) {
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        error instanceof Error ? error.message : "Invalid AI_PROVIDER_CONFIG"
      )
    }

    const enabled = envProviders.filter((p) => p.enabled !== false)
    if (enabled.length === 0) {
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        "AI_PROVIDER_CONFIG has no enabled providers"
      )
    }

    return enabled.map((p) => this.readProviderConfig(p.name))
  }

  private readProviderConfig(name: AIProviderName): ProviderConfig {
    const entry = readAIProviderConfig().find((p) => p.name === name)
    if (!entry) {
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        `Provider '${name}' not found in AI_PROVIDER_CONFIG`
      )
    }
    const service = this.resolveProviderService(name, entry.serviceName)

    return {
      name,
      service,
      priority: entry.priority,
      dailyBudgetRequests: entry.dailyBudgetRequests,
      dailyBudgetTokens: entry.dailyBudgetTokens,
      maxConcurrency: entry.maxConcurrency,
      maxRequestsPerMinute: entry.maxRequestsPerMinute,
    }
  }

  private resolveProviderService(
    providerName: string,
    serviceId: string
  ): IProxyIAService {
    const serviceName = serviceId.toLowerCase()

    if (serviceName === "groq") return GroqService.getInstance()
    if (serviceName === "gemini") return GeminiService.getInstance()
    if (serviceName === "cerebras") return CerebrasService.getInstance()
    if (serviceName === "openrouter") return OpenRouterService.getInstance()

    throw new AIProviderError(
      "Router",
      undefined,
      AIProviderErrorCode.CONFIG_ERROR,
      `Unsupported service '${serviceName}' for provider '${providerName}'. Allowed: groq|gemini|cerebras|openrouter`
    )
  }

  private async rankProviders(
    estimatedTokens: number
  ): Promise<ProviderCandidate[]> {
    const candidates: ProviderCandidate[] = []
    const now = Date.now()
    const day = this.dayKey()
    const sliceId = this.sliceId()
    const minuteId = this.minuteId()

    const providerSnapshots: Array<{
      cfg: ProviderConfig
      candidate?: ProviderCandidate
      eligibleWithoutReserve: boolean
      dailyRemainingRatio: number
    }> = []

    for (const cfg of this.configs) {
      const blockedUntil =
        (await this.getValue<number>(this.blockedUntilKey(cfg.name))) || 0
      const cooldownUntil =
        (await this.getValue<number>(this.cooldownUntilKey(cfg.name))) || 0

      const dailyUsed = await this.readCounter(
        this.dailyRequestCounterKey(cfg.name, day)
      )
      const minuteUsed = await this.readCounter(
        this.minuteRequestCounterKey(cfg.name, minuteId)
      )
      const sliceUsed = await this.readCounter(
        this.sliceRequestCounterKey(cfg.name, day, sliceId)
      )

      const dailyRemainingRequests = Math.max(
        cfg.dailyBudgetRequests - dailyUsed,
        0
      )
      const minuteRemainingRequests = Math.max(
        cfg.maxRequestsPerMinute - minuteUsed,
        0
      )

      const sliceBudget = this.sliceBudget(cfg.dailyBudgetRequests)
      const sliceRemainingRequests = Math.max(sliceBudget - sliceUsed, 0)

      const activeConcurrency = await this.readCounter(
        this.concurrencyKey(cfg.name)
      )
      const concurrencyRemaining = Math.max(
        cfg.maxConcurrency - activeConcurrency,
        0
      )

      const dailyUsedTokens = await this.readCounter(
        this.dailyTokenCounterKey(cfg.name, day)
      )
      const dailyRemainingTokens =
        cfg.dailyBudgetTokens > 0
          ? Math.max(cfg.dailyBudgetTokens - dailyUsedTokens, 0)
          : undefined

      const externalQuota = await this.getExternalQuota(cfg.name)
      const externalRemainingRequests = this.validExternalRemaining(
        externalQuota?.remainingRequests,
        externalQuota?.resetAtUnixMs,
        now
      )
      const externalRemainingTokens = this.validExternalRemaining(
        externalQuota?.remainingTokens,
        externalQuota?.resetAtUnixMs,
        now
      )

      const effectiveDailyRemainingRequests =
        externalRemainingRequests !== undefined
          ? Math.min(dailyRemainingRequests, externalRemainingRequests)
          : dailyRemainingRequests

      const effectiveDailyRemainingTokens =
        dailyRemainingTokens === undefined
          ? externalRemainingTokens
          : externalRemainingTokens === undefined
            ? dailyRemainingTokens
            : Math.min(dailyRemainingTokens, externalRemainingTokens)

      const reasons: string[] = []
      let eligible = true

      if (blockedUntil > now) {
        eligible = false
        reasons.push(`blocked_until=${new Date(blockedUntil).toISOString()}`)
      }

      if (cooldownUntil > now) {
        eligible = false
        reasons.push(`cooldown_until=${new Date(cooldownUntil).toISOString()}`)
      }

      if (effectiveDailyRemainingRequests <= 0) {
        eligible = false
        reasons.push("daily_budget_exhausted")
      }

      if (sliceRemainingRequests <= 0) {
        eligible = false
        reasons.push("slice_budget_exhausted")
      }

      if (minuteRemainingRequests <= 0) {
        eligible = false
        reasons.push("rpm_exhausted")
      }

      if (concurrencyRemaining <= 0) {
        eligible = false
        reasons.push("concurrency_exhausted")
      }

      if (
        effectiveDailyRemainingTokens !== undefined &&
        effectiveDailyRemainingTokens > 0 &&
        effectiveDailyRemainingTokens < estimatedTokens
      ) {
        eligible = false
        reasons.push("token_budget_exhausted")
      }

      const health = await this.getHealth(cfg.name)
      const healthScore = this.calculateHealthScore(health)

      const dailyRemainingRatio =
        cfg.dailyBudgetRequests > 0
          ? effectiveDailyRemainingRequests / cfg.dailyBudgetRequests
          : 0

      const externalPenalty =
        externalRemainingRequests !== undefined &&
        cfg.dailyBudgetRequests > 0 &&
        externalRemainingRequests / cfg.dailyBudgetRequests <=
          this.externalRemainingLowThreshold
          ? 20
          : 0

      const score =
        cfg.priority * 0.35 +
        healthScore * 0.25 +
        dailyRemainingRatio * 25 +
        (sliceRemainingRequests / Math.max(sliceBudget, 1)) * 10 +
        (minuteRemainingRequests / Math.max(cfg.maxRequestsPerMinute, 1)) * 5 -
        externalPenalty

      const candidate: ProviderCandidate = {
        provider: cfg.name,
        score,
        reasons: reasons.length ? reasons : ["eligible"],
        snapshot: {
          healthScore,
          dailyRemainingRequests: effectiveDailyRemainingRequests,
          sliceRemainingRequests,
          minuteRemainingRequests,
          concurrencyRemaining,
          dailyRemainingTokens: effectiveDailyRemainingTokens,
          externalRemainingRequests,
          externalRemainingTokens,
        },
      }

      providerSnapshots.push({
        cfg,
        candidate,
        eligibleWithoutReserve: eligible,
        dailyRemainingRatio,
      })
    }

    const hasPrimaryEligible = providerSnapshots.some(
      (s) => s.cfg.name !== "openrouter" && s.eligibleWithoutReserve
    )

    const reserveCanBeReleased = this.shouldReleaseOpenRouter(
      providerSnapshots,
      hasPrimaryEligible
    )

    for (const snapshot of providerSnapshots) {
      const c = snapshot.candidate
      if (!c) continue

      let eligible = snapshot.eligibleWithoutReserve

      if (
        this.reserveOpenRouter &&
        snapshot.cfg.name === "openrouter" &&
        hasPrimaryEligible &&
        !reserveCanBeReleased
      ) {
        eligible = false
        c.reasons.push("openrouter_reserved")
      }

      this.logger.info(
        `AI Router evaluate provider=${snapshot.cfg.name} eligible=${eligible} reasons=${c.reasons.join("|")} dayRem=${c.snapshot.dailyRemainingRequests} sliceRem=${c.snapshot.sliceRemainingRequests} rpmRem=${c.snapshot.minuteRemainingRequests} extRem=${c.snapshot.externalRemainingRequests ?? -1}`
      )

      if (eligible) {
        candidates.push(c)
      }
    }

    candidates.sort((a, b) => b.score - a.score)
    return candidates
  }

  private shouldReleaseOpenRouter(
    providerSnapshots: Array<{
      cfg: ProviderConfig
      candidate?: ProviderCandidate
      eligibleWithoutReserve: boolean
      dailyRemainingRatio: number
    }>,
    hasPrimaryEligible: boolean
  ): boolean {
    if (!this.reserveOpenRouter) return true
    if (!hasPrimaryEligible) return true

    const primary = providerSnapshots.filter((s) => s.cfg.name !== "openrouter")
    if (primary.length === 0) return true

    const avgRemainingRatio =
      primary.reduce((acc, s) => acc + s.dailyRemainingRatio, 0) /
      primary.length

    const hoursToReset = this.secondsUntilNextDay() / 3600

    return (
      hoursToReset <= this.releaseOpenRouterHoursToReset &&
      avgRemainingRatio <= this.releaseOpenRouterPrimaryRemainingThreshold
    )
  }

  private async applyExternalQuota(
    provider: AIProviderName,
    meta: AIExecutionMeta
  ): Promise<void> {
    const hasUsefulData =
      meta.remainingRequests !== undefined ||
      meta.remainingTokens !== undefined ||
      meta.resetAtUnixMs !== undefined

    if (!hasUsefulData) return

    const ttl = this.ttlFromReset(meta.resetAtUnixMs)
    const quota: ProviderExternalQuota = {
      remainingRequests: meta.remainingRequests,
      remainingTokens: meta.remainingTokens,
      resetAtUnixMs: meta.resetAtUnixMs,
      updatedAt: Date.now(),
    }

    await this.setValue(this.externalQuotaKey(provider), quota, ttl)
  }

  private async getExternalQuota(
    provider: AIProviderName
  ): Promise<ProviderExternalQuota | null> {
    return this.getValue<ProviderExternalQuota>(this.externalQuotaKey(provider))
  }

  private validExternalRemaining(
    value: number | undefined,
    resetAtUnixMs: number | undefined,
    now: number
  ): number | undefined {
    if (value === undefined) return undefined
    if (resetAtUnixMs && resetAtUnixMs <= now) return undefined
    return Math.max(0, value)
  }

  private ttlFromReset(resetAtUnixMs?: number): number {
    if (!resetAtUnixMs) return 3600
    const ttl = Math.floor((resetAtUnixMs - Date.now()) / 1000)
    return Math.max(60, ttl)
  }

  private estimateTokens(text: string): number {
    if (!text) return 0
    return Math.ceil(text.length / 4)
  }

  private sliceBudget(dailyBudget: number): number {
    const slicesPerDay = Math.max(1, Math.floor((24 * 60) / this.sliceMinutes))
    return Math.max(
      1,
      Math.ceil((dailyBudget / slicesPerDay) * this.sliceBurstFactor)
    )
  }

  private async markSuccess(provider: AIProviderName): Promise<void> {
    const health = await this.getHealth(provider)
    health.success += 1
    health.updatedAt = Date.now()
    await this.setHealth(provider, health)
  }

  private async markFailure(
    provider: AIProviderName,
    error: AIProviderError
  ): Promise<void> {
    const now = Date.now()
    const health = await this.getHealth(provider)
    health.failures += 1
    health.lastErrorCode = error.code
    health.lastErrorMessage = error.rawMessage
    health.updatedAt = now

    if (error.code === AIProviderErrorCode.INVALID_RESPONSE) {
      health.invalidResponses += 1
      await this.setValue(
        this.cooldownUntilKey(provider),
        now + this.cooldownProviderErrorSeconds * 1000,
        this.cooldownProviderErrorSeconds
      )
    } else if (
      error.code === AIProviderErrorCode.AUTH_ERROR ||
      error.code === AIProviderErrorCode.CONFIG_ERROR
    ) {
      health.providerErrors += 1
      await this.setValue(
        this.blockedUntilKey(provider),
        now + this.blockPaymentRequiredSeconds * 1000,
        this.blockPaymentRequiredSeconds
      )
    } else if (error.code === AIProviderErrorCode.LIMIT_EXCEEDED) {
      if (error.status === 402) {
        health.billingRequired += 1
        await this.setValue(
          this.blockedUntilKey(provider),
          now + this.blockPaymentRequiredSeconds * 1000,
          this.blockPaymentRequiredSeconds
        )
      } else {
        health.rateLimited += 1
        await this.setValue(
          this.cooldownUntilKey(provider),
          now + this.cooldownRateLimitSeconds * 1000,
          this.cooldownRateLimitSeconds
        )
      }
    } else {
      health.providerErrors += 1
      await this.setValue(
        this.cooldownUntilKey(provider),
        now + this.cooldownProviderErrorSeconds * 1000,
        this.cooldownProviderErrorSeconds
      )
    }

    await this.setHealth(provider, health)
  }

  private async getHealth(
    provider: AIProviderName
  ): Promise<ProviderHealthState> {
    const key = this.healthKey(provider)
    const current = await this.getValue<ProviderHealthState>(key)

    if (current) return current

    return {
      success: 0,
      failures: 0,
      invalidResponses: 0,
      rateLimited: 0,
      billingRequired: 0,
      providerErrors: 0,
      updatedAt: Date.now(),
    }
  }

  private async setHealth(
    provider: AIProviderName,
    health: ProviderHealthState
  ): Promise<void> {
    await this.setValue(this.healthKey(provider), health, 7 * 24 * 60 * 60)
  }

  private calculateHealthScore(health: ProviderHealthState): number {
    const total = health.success + health.failures
    if (total === 0) return 100

    const successRate = (health.success / total) * 100
    const penalty =
      health.invalidResponses * 4 +
      health.rateLimited * 2 +
      health.billingRequired * 5 +
      health.providerErrors * 2

    return Math.max(0, successRate - penalty)
  }

  private async consumeRequestsBudget(
    provider: AIProviderName,
    count: number
  ): Promise<number> {
    const day = this.dayKey()
    const minute = this.minuteId()
    const slice = this.sliceId()

    await this.adjustCounter(
      this.dailyRequestCounterKey(provider, day),
      count,
      this.secondsUntilNextDay()
    )
    await this.adjustCounter(
      this.sliceRequestCounterKey(provider, day, slice),
      count,
      this.secondsUntilSliceEnd()
    )
    return this.adjustCounter(
      this.minuteRequestCounterKey(provider, minute),
      count,
      this.secondsUntilMinuteEnd()
    )
  }

  private async consumeTokensBudget(
    provider: AIProviderName,
    tokens: number
  ): Promise<number> {
    return this.adjustCounter(
      this.dailyTokenCounterKey(provider, this.dayKey()),
      tokens,
      this.secondsUntilNextDay()
    )
  }

  private async incrementMetric(
    provider: AIProviderName,
    metric: "success" | "error" | "assigned" | "latencyMs",
    amount: number
  ): Promise<number> {
    return this.adjustCounter(
      this.metricKey(this.dayKey(), provider, metric),
      amount,
      this.secondsUntilNextDay()
    )
  }

  private async acquireConcurrencySlot(
    config: ProviderConfig
  ): Promise<boolean> {
    const key = this.concurrencyKey(config.name)
    const current = await this.adjustCounter(key, 1, 60)

    if (current > config.maxConcurrency) {
      await this.adjustCounter(key, -1, 60, true)
      return false
    }

    return true
  }

  private async releaseConcurrencySlot(config: ProviderConfig): Promise<void> {
    const key = this.concurrencyKey(config.name)
    await this.adjustCounter(key, -1, 60, true)
  }

  private async adjustCounter(
    key: string,
    delta: number,
    ttlSeconds: number,
    clampToZero = false
  ): Promise<number> {
    return this.adjustCounterRedisAtomic(key, delta, ttlSeconds, clampToZero)
  }

  private async adjustCounterRedisAtomic(
    key: string,
    delta: number,
    ttlSeconds: number,
    clampToZero: boolean
  ): Promise<number> {
    await this.ensureRedisConnection()

    const script = `
local key = KEYS[1]
local delta = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local clamp = ARGV[3] == "1"

local current = tonumber(redis.call("GET", key) or "0")
local next = current + delta
if clamp and next < 0 then
  next = 0
end

redis.call("SET", key, tostring(next))
local currentTtl = redis.call("TTL", key)
if currentTtl < 0 then
  redis.call("EXPIRE", key, ttl)
end

return tostring(next)
`

    const raw = (await this.redisClient.eval(
      script,
      1,
      key,
      String(delta),
      String(ttlSeconds),
      clampToZero ? "1" : "0"
    )) as string | number
    return Number(raw) || 0
  }

  private async readCounter(key: string): Promise<number> {
    await this.ensureRedisConnection()
    const raw = await this.redisClient.get(key)
    const n = Number(raw ?? 0)
    return Number.isFinite(n) ? n : 0
  }

  private async setValue(
    key: string,
    value: unknown,
    ttlSeconds: number
  ): Promise<void> {
    await this.ensureRedisConnection()
    await this.redisClient.set(
      key,
      JSON.stringify(value ?? null),
      "EX",
      ttlSeconds
    )
  }

  private async getValue<T>(key: string): Promise<T | null> {
    await this.ensureRedisConnection()
    const raw = await this.redisClient.get(key)
    if (!raw) return null

    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  private async ensureRedisConnection(): Promise<void> {
    if (
      this.redisClient.status === "ready" ||
      this.redisClient.status === "connecting"
    ) {
      return
    }

    try {
      await this.redisClient.connect()
    } catch (error) {
      this.logger.error("AI Router redis connection failed", { error })
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        "Redis is required for AIProviderRouter and connection failed"
      )
    }
  }

  private getConfig(provider: AIProviderName): ProviderConfig | undefined {
    return this.configs.find((c) => c.name === provider)
  }

  private dayKey(date = new Date()): string {
    return date.toISOString().slice(0, 10)
  }

  private minuteId(date = new Date()): string {
    const yyyy = date.getUTCFullYear()
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
    const dd = String(date.getUTCDate()).padStart(2, "0")
    const hh = String(date.getUTCHours()).padStart(2, "0")
    const mi = String(date.getUTCMinutes()).padStart(2, "0")
    return `${yyyy}${mm}${dd}${hh}${mi}`
  }

  private sliceId(date = new Date()): string {
    const utcStartOfDay = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0
    )
    const minutesFromDayStart = Math.floor(
      (date.getTime() - utcStartOfDay) / 60000
    )
    const slot = Math.floor(minutesFromDayStart / this.sliceMinutes)
    return String(slot)
  }

  private secondsUntilNextDay(): number {
    const now = new Date()
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    )
    return Math.max(60, Math.floor((tomorrow.getTime() - now.getTime()) / 1000))
  }

  private secondsUntilMinuteEnd(): number {
    const now = new Date()
    const nextMinute = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes() + 1,
        0,
        0
      )
    )
    return Math.max(
      1,
      Math.floor((nextMinute.getTime() - now.getTime()) / 1000)
    )
  }

  private secondsUntilSliceEnd(): number {
    const now = new Date()
    const utcStartOfDay = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
    const minutesFromDayStart = Math.floor(
      (now.getTime() - utcStartOfDay) / 60000
    )
    const currentSlice = Math.floor(minutesFromDayStart / this.sliceMinutes)
    const nextSliceMinutes = (currentSlice + 1) * this.sliceMinutes
    const nextSlice = new Date(utcStartOfDay + nextSliceMinutes * 60000)
    return Math.max(1, Math.floor((nextSlice.getTime() - now.getTime()) / 1000))
  }

  private healthKey(provider: AIProviderName): string {
    return `ai:router:health:${provider}`
  }

  private blockedUntilKey(provider: AIProviderName): string {
    return `ai:router:block:${provider}`
  }

  private cooldownUntilKey(provider: AIProviderName): string {
    return `ai:router:cooldown:${provider}`
  }

  private dailyRequestCounterKey(
    provider: AIProviderName,
    day: string
  ): string {
    return `ai:router:daily:req:${day}:${provider}`
  }

  private dailyTokenCounterKey(provider: AIProviderName, day: string): string {
    return `ai:router:daily:tok:${day}:${provider}`
  }

  private minuteRequestCounterKey(
    provider: AIProviderName,
    minuteId: string
  ): string {
    return `ai:router:minute:req:${minuteId}:${provider}`
  }

  private sliceRequestCounterKey(
    provider: AIProviderName,
    day: string,
    sliceId: string
  ): string {
    return `ai:router:slice:req:${day}:${sliceId}:${provider}`
  }

  private externalQuotaKey(provider: AIProviderName): string {
    return `ai:router:extquota:${provider}`
  }

  private metricKey(
    day: string,
    provider: AIProviderName,
    metric: "success" | "error" | "assigned" | "latencyMs"
  ): string {
    return `ai:router:metric:${day}:${provider}:${metric}`
  }

  private concurrencyKey(provider: AIProviderName): string {
    return `ai:router:concurrency:${provider}`
  }

  private requiredStringEnv(key: string): string {
    const value = process.env[key]
    if (!value) {
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        `Missing required env var: ${key}`
      )
    }
    return value
  }

  private requiredNumberEnv(key: string): number {
    const raw = this.requiredStringEnv(key)
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      throw new AIProviderError(
        "Router",
        undefined,
        AIProviderErrorCode.CONFIG_ERROR,
        `Env var ${key} must be a valid number`
      )
    }
    return n
  }

  private requiredBooleanEnv(key: string): boolean {
    const raw = this.requiredStringEnv(key).toLowerCase()
    if (raw === "true") return true
    if (raw === "false") return false
    throw new AIProviderError(
      "Router",
      undefined,
      AIProviderErrorCode.CONFIG_ERROR,
      `Env var ${key} must be 'true' or 'false'`
    )
  }
}
