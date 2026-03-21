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

export const runAIAuthStatusCommand = async (
  options: Partial<AIAuthCommandOptions>,
  deps: AIAuthCommandDependencies
): Promise<void> => {
  const normalized = normalizeCommandOptions(options)
  assertCodexProvider(normalized.provider)

  const { authService } = resolveCommandServices(deps)
  const status = authService.getStatus(
    normalized.profile,
    findAIProviderByService("codex")
  )

  deps.io.writeLine(`Provider: codex`)
  deps.io.writeLine(`Profile: ${normalized.profile}`)
  deps.io.writeLine(`Existe: ${status.exists ? "yes" : "no"}`)
  deps.io.writeLine(`Expirado: ${status.isExpired ? "yes" : "no"}`)
  deps.io.writeLine(`Expira pronto: ${status.isExpiringSoon ? "yes" : "no"}`)
  if (status.expiresAtUnixMs) {
    deps.io.writeLine(
      `ExpiresAt: ${new Date(status.expiresAtUnixMs).toISOString()}`
    )
  }
  if (status.account?.email) {
    deps.io.writeLine(`Email: ${status.account.email}`)
  }
  if (status.account?.chatgptAccountId) {
    deps.io.writeLine(`AccountId: ${status.account.chatgptAccountId}`)
  }
}
