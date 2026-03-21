import type { AIAuthCommandDependencies } from "@/package/ai/cli/AIAuthCLI.types"
import {
  assertCodexProvider,
  resolveCommandServices,
} from "@/package/ai/cli/commands/AIAuthCommand.helpers"
import { findAIProviderByService } from "@/package/ai/helpers/AIProviderConfig.helper"

export const runAIAuthProfilesListCommand = async (
  provider: string,
  deps: AIAuthCommandDependencies
): Promise<void> => {
  assertCodexProvider(provider)

  const { authService } = resolveCommandServices(deps)
  const profiles = authService.listProfiles(findAIProviderByService("codex"))

  if (profiles.length === 0) {
    deps.io.writeLine("No hay profiles guardados para codex.")
    return
  }

  for (const profile of profiles) {
    deps.io.writeLine(profile)
  }
}
