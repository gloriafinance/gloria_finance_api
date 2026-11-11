import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = realpathSync(resolve(import.meta.dir, ".."))
const baseRef = process.argv[2] ?? "origin/main"
const diagnosticHeader = /^.+\(\d+,\d+\): error TS\d+: /
const decoder = new TextDecoder()

function run(command: string[], cwd: string, input?: Uint8Array) {
  const result = Bun.spawnSync(command, { cwd, stdin: input })
  if (!result.success) {
    throw new Error(
      `${command.join(" ")} failed:\n${decoder.decode(result.stderr)}`
    )
  }
  return result.stdout
}

function collectDiagnostics(cwd: string): string[] {
  const result = Bun.spawnSync(
    [
      join(cwd, "node_modules", ".bin", "tsc"),
      "--project",
      "tsconfig.build.json",
      "--noEmit",
      "--pretty",
      "false",
    ],
    { cwd }
  )
  if (result.success) return []

  const output = decoder
    .decode(result.stdout)
    .replaceAll("\r\n", "\n")
    .trimEnd()
  const stderr = decoder.decode(result.stderr).trim()
  const diagnostics = output
    .split(/(?=^.+\(\d+,\d+\): error TS\d+: )/m)
    .map((diagnostic) => diagnostic.trimEnd())
  // Config and compiler failures are never treated as existing source debt.
  if (
    stderr ||
    diagnostics.some((diagnostic) => !diagnosticHeader.test(diagnostic)) ||
    /^error TS\d+:/m.test(output)
  ) {
    throw new Error(`TypeScript could not check ${cwd}:\n${output}\n${stderr}`)
  }
  return diagnostics
}

function diagnosticKeyFor(cwd: string) {
  const directories = [
    [realpathSync(join(cwd, "node_modules")), "<repo>/node_modules"],
    [cwd, "<repo>"],
    [root, "<repo>"],
  ] as const
  return (diagnostic: string) => {
    // Match by file and message, independent of line and checkout location.
    let key = diagnostic.replace(/^(.+)\(\d+,\d+\): /, "$1: ")
    for (const [directory, label] of directories) {
      key = key.replaceAll(`${directory}/`, `${label}/`)
      if (
        process.platform === "darwin" &&
        /^\/private\/(tmp|var)\//.test(directory)
      ) {
        key = key.replaceAll(
          `${directory.slice("/private".length)}/`,
          `${label}/`
        )
      }
    }
    return key
  }
}

const current = collectDiagnostics(root)
if (current.length === 0) {
  console.log("TypeScript: no errors.")
} else {
  const base = decoder
    .decode(
      run(
        [
          "git",
          "rev-parse",
          "--verify",
          "--end-of-options",
          `${baseRef}^{commit}`,
        ],
        root
      )
    )
    .trim()
  const baselineDir = mkdtempSync(
    join(realpathSync(tmpdir()), "gloria-typecheck-")
  )
  try {
    run(["tar", "-xf", "-"], baselineDir, run(["git", "archive", base], root))
    // Compare both revisions under the same checking policy, even when the
    // base still uses the old TypeScript config.
    for (const config of ["tsconfig.json", "tsconfig.build.json"]) {
      copyFileSync(join(root, config), join(baselineDir, config))
    }
    if (
      readFileSync(join(root, "bun.lock"), "utf8") ===
      readFileSync(join(baselineDir, "bun.lock"), "utf8")
    ) {
      symlinkSync(
        join(root, "node_modules"),
        join(baselineDir, "node_modules"),
        "dir"
      )
    } else {
      run(["bun", "install", "--frozen-lockfile"], baselineDir)
    }

    const baseline = collectDiagnostics(baselineDir)
    const baselineKey = diagnosticKeyFor(baselineDir)
    const currentKey = diagnosticKeyFor(root)
    const counts = new Map<string, number>()
    for (const diagnostic of baseline) {
      const key = baselineKey(diagnostic)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const regressions = current.filter((diagnostic) => {
      const key = currentKey(diagnostic)
      const count = counts.get(key) ?? 0
      if (!count) return true
      counts.set(key, count - 1)
      return false
    })

    if (regressions.length) {
      console.error(
        `TypeScript: ${regressions.length} new errors against ${baseRef}.\n${regressions.join("\n")}`
      )
      process.exitCode = 1
    } else {
      console.log(
        `TypeScript: no new errors against ${baseRef} (${current.length} existing, ${baseline.length} in base).`
      )
    }
  } finally {
    rmSync(baselineDir, { recursive: true, force: true })
  }
}
