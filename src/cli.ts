import { createNodeCLIIO } from "@/package/ai/cli/CLIIO.interface"
import { runAIAuthLoginCommand } from "@/package/ai/cli/commands/ai-auth-login.command"
import { runAIAuthStatusCommand } from "@/package/ai/cli/commands/ai-auth-status.command"
import { runAIAuthRefreshCommand } from "@/package/ai/cli/commands/ai-auth-refresh.command"
import { runAIAuthLogoutCommand } from "@/package/ai/cli/commands/ai-auth-logout.command"
import { runAIAuthProfilesListCommand } from "@/package/ai/cli/commands/ai-auth-profiles-list.command"

const parseFlags = (args: string[]): Record<string, string> => {
  const flags: Record<string, string> = {}
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token?.startsWith("--")) continue

    const key = token.slice(2)
    const value = args[index + 1]
    if (value && !value.startsWith("--")) {
      flags[key] = value
      index += 1
      continue
    }

    flags[key] = "true"
  }
  return flags
}

const printUsage = (io: ReturnType<typeof createNodeCLIIO>): void => {
  io.writeLine("Uso:")
  io.writeLine("  myapp ai auth login --provider codex --profile personal")
  io.writeLine("  myapp ai auth status --provider codex --profile personal")
  io.writeLine("  myapp ai auth refresh --provider codex --profile personal")
  io.writeLine("  myapp ai auth logout --provider codex --profile personal")
  io.writeLine("  myapp ai auth profiles list --provider codex")
}

const main = async (): Promise<void> => {
  const io = createNodeCLIIO()
  try {
    const args = process.argv.slice(2)
    const flags = parseFlags(args)

    if (args[0] !== "ai" || args[1] !== "auth") {
      printUsage(io)
      process.exitCode = 1
      return
    }

    const provider = flags.provider ?? "codex"
    const profile = flags.profile ?? "default"
    const command = args[2]
    const subcommand = args[3]

    if (command === "login") {
      await runAIAuthLoginCommand({ provider, profile }, { io })
      return
    }

    if (command === "status") {
      await runAIAuthStatusCommand({ provider, profile }, { io })
      return
    }

    if (command === "refresh") {
      await runAIAuthRefreshCommand({ provider, profile }, { io })
      return
    }

    if (command === "logout") {
      await runAIAuthLogoutCommand({ provider, profile }, { io })
      return
    }

    if (command === "profiles" && subcommand === "list") {
      await runAIAuthProfilesListCommand(provider, { io })
      return
    }

    printUsage(io)
    process.exitCode = 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    io.writeError(message)
    process.exitCode = 1
  } finally {
    io.close?.()
  }
}

void main()
