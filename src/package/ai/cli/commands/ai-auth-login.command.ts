import type {
  AIAuthCommandDependencies,
  AIAuthCommandOptions,
} from "@/package/ai/cli/AIAuthCLI.types"
import { CodexOAuthError } from "@/package/ai/auth/codex-oauth/CodexOAuthError"
import { findAIProviderByService } from "@/package/ai/helpers/AIProviderConfig.helper"
import { resolveCodexOAuthConfig } from "@/package/ai/auth/codex-oauth/CodexOAuthConfig"
import {
  assertCodexProvider,
  normalizeCommandOptions,
  resolveCommandServices,
} from "@/package/ai/cli/commands/AIAuthCommand.helpers"

export const runAIAuthLoginCommand = async (
  options: Partial<AIAuthCommandOptions>,
  deps: AIAuthCommandDependencies
): Promise<void> => {
  const normalized = normalizeCommandOptions(options)
  assertCodexProvider(normalized.provider)

  const { authService, deviceCodeAuthService } = resolveCommandServices(deps)
  const providerCfg = findAIProviderByService("codex")
  const oauthConfig = resolveCodexOAuthConfig(providerCfg)

  if (new URL(oauthConfig.issuer).hostname === "auth.openai.com") {
    const session = await deviceCodeAuthService.start(providerCfg)

    deps.io.writeLine(`Provider: codex`)
    deps.io.writeLine(`Profile: ${normalized.profile}`)
    deps.io.writeLine("")
    deps.io.writeLine("OpenAI requiere device-code para este issuer.")
    deps.io.writeLine("Abre esta URL en tu navegador:")
    deps.io.writeLine(session.verificationUrl)
    deps.io.writeLine("")
    deps.io.writeLine("Ingresa este código de una sola vez:")
    deps.io.writeLine(session.userCode)
    deps.io.writeLine("")
    deps.io.writeLine("La CLI esperará automáticamente la autorización.")

    const profile = await deviceCodeAuthService.complete({
      profileId: normalized.profile,
      session,
      providerCfg,
    })

    deps.io.writeLine("")
    deps.io.writeLine(`Profile guardado: ${profile.profileId}`)
    deps.io.writeLine(
      `Expira: ${new Date(profile.tokenSet.expiresAtUnixMs).toISOString()}`
    )
    deps.io.writeLine("Provider listo para uso.")
    return
  }

  const session = authService.createAuthorizationSession(providerCfg)

  deps.io.writeLine(`Provider: codex`)
  deps.io.writeLine(`Profile: ${normalized.profile}`)
  deps.io.writeLine("")
  deps.io.writeLine("Abre esta URL en tu navegador, inicia sesión y autoriza:")
  deps.io.writeLine(session.authorizationUrl)
  deps.io.writeLine("")
  deps.io.writeLine("Luego copia el authorization code y pégalo aquí.")

  let lastError: Error | undefined
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const code = await deps.io.prompt("Pega aquí el authorization code: ")

    try {
      const profile = await authService.exchangeAuthorizationCode({
        profileId: normalized.profile,
        authorizationCode: code,
        session,
        providerCfg,
      })

      deps.io.writeLine("")
      deps.io.writeLine(`Profile guardado: ${profile.profileId}`)
      deps.io.writeLine(
        `Expira: ${new Date(profile.tokenSet.expiresAtUnixMs).toISOString()}`
      )
      deps.io.writeLine("Provider listo para uso.")
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      deps.io.writeError(`Login falló (${attempt}/3): ${lastError.message}`)

      if (!(error instanceof CodexOAuthError) || attempt === 3) {
        break
      }
    }
  }

  throw lastError ?? new Error("Codex OAuth login failed")
}
