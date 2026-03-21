import type { CLIIO } from "@/package/ai/cli/CLIIO.interface"
import { CodexOAuthCLIAuthService } from "@/package/ai/auth/codex-oauth/CodexOAuthCLIAuthService"
import { CodexOAuthTokenManager } from "@/package/ai/providers/codex/CodexOAuthTokenManager"
import { CodexDeviceCodeAuthService } from "@/package/ai/auth/codex-oauth/CodexDeviceCodeAuthService"

export type AIAuthCommandOptions = {
  provider: string
  profile: string
}

export type AIAuthCommandDependencies = {
  io: CLIIO
  authService?: CodexOAuthCLIAuthService
  tokenManager?: CodexOAuthTokenManager
  deviceCodeAuthService?: CodexDeviceCodeAuthService
}
