import type {
  AIAuthCommandDependencies,
  AIAuthCommandOptions,
} from "@/package/ai/cli/AIAuthCLI.types"
import {
  assertCodexProvider,
  normalizeCommandOptions,
  resolveCommandServices,
} from "@/package/ai/cli/commands/AIAuthCommand.helpers"
import { findAIProviderByService } from "@/package/ai/helpers/AIProviderConfig.helper"

export const runAIAuthLogoutCommand = async (
  options: Partial<AIAuthCommandOptions>,
  deps: AIAuthCommandDependencies
): Promise<void> => {
  const normalized = normalizeCommandOptions(options)
  assertCodexProvider(normalized.provider)

  const { authService, tokenManager } = resolveCommandServices(deps)
  const providerCfg = findAIProviderByService("codex")
  const removed = authService.logout(normalized.profile, providerCfg)
  tokenManager.clearMemoryCache(normalized.profile, providerCfg)

  deps.io.writeLine(`Provider: codex`)
  deps.io.writeLine(`Profile: ${normalized.profile}`)
  deps.io.writeLine(`Eliminado localmente: ${removed ? "yes" : "no"}`)
}
