import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { generateKeyPairSync } from "node:crypto"

const envPath = ".env"
const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : ""
const updates: Record<string, string> = {}

const signingPrivateKey = getEnvValue(env, "CHURCH_BANKING_SIGNING_PRIVATE_JWK")

if (signingPrivateKey && signingPrivateKey !== "") {
  console.error(
    "CHURCH_BANKING_SIGNING_PRIVATE_JWK ya tiene una clave asignada"
  )
  process.exit(0)
}

const { privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
})

updates.CHURCH_BANKING_SIGNING_PRIVATE_JWK = JSON.stringify(
  privateKey.export({ format: "jwk" })
)

let nextEnv = env

for (const [key, value] of Object.entries(updates)) {
  const line = `${key}=${value}`

  if (new RegExp(`^${key}=.*$`, "m").test(nextEnv)) {
    nextEnv = nextEnv.replace(new RegExp(`^${key}=.*$`, "m"), line)
  } else {
    nextEnv = `${nextEnv.trimEnd()}\n${line}\n`
  }
}

writeFileSync(envPath, nextEnv, "utf8")
console.info("Updated .env with payload key settings")

function getEnvValue(envContent: string, key: string): string | undefined {
  return envContent.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim()
}
