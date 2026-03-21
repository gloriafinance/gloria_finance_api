import type {
  AIAuthCommandDependencies,
  AIAuthCommandOptions,
} from "@/package/ai/cli/AIAuthCLI.types"
import { CodexOAuthCLIAuthService } from "@/package/ai/auth/codex-oauth/CodexOAuthCLIAuthService"
import { CodexOAuthTokenManager } from "@/package/ai/providers/codex/CodexOAuthTokenManager"
import { CodexDeviceCodeAuthService } from "@/package/ai/auth/codex-oauth/CodexDeviceCodeAuthService"

export const assertCodexProvider = (provider: string): void => {
  if (provider.toLowerCase() !== "codex") {
    throw new Error(
      `Unsupported provider '${provider}'. Only 'codex' is implemented for auth commands.`
    )
  }
}

export const normalizeCommandOptions = (
  options: Partial<AIAuthCommandOptions>
): AIAuthCommandOptions => {
  return {
    provider: (options.provider ?? "codex").trim().toLowerCase(),
    profile: (options.profile ?? "default").trim(),
  }
}

export const resolveCommandServices = (deps: AIAuthCommandDependencies) => {
  return {
    authService: deps.authService ?? new CodexOAuthCLIAuthService(),
    deviceCodeAuthService:
      deps.deviceCodeAuthService ?? new CodexDeviceCodeAuthService(),
    tokenManager: deps.tokenManager ?? CodexOAuthTokenManager.getInstance(),
  }
}
