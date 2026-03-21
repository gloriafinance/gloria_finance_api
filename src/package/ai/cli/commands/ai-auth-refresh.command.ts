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

export const runAIAuthRefreshCommand = async (
  options: Partial<AIAuthCommandOptions>,
  deps: AIAuthCommandDependencies
): Promise<void> => {
  const normalized = normalizeCommandOptions(options)
  assertCodexProvider(normalized.provider)

  const { tokenManager } = resolveCommandServices(deps)
  const profile = await tokenManager.forceRefresh(
    normalized.profile,
    findAIProviderByService("codex")
  )

  deps.io.writeLine(`Provider: codex`)
  deps.io.writeLine(`Profile: ${normalized.profile}`)
  deps.io.writeLine(
    `Expira: ${new Date(profile.tokenSet.expiresAtUnixMs).toISOString()}`
  )
}
