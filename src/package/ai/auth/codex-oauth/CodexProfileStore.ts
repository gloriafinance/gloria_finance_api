import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import type {
  CodexOAuthStoredProfile,
  CodexOAuthTokenSet,
} from "@/package/ai/auth/codex-oauth/CodexOAuth.types"
import {
  CodexOAuthError,
  CodexOAuthErrorCode,
} from "@/package/ai/auth/codex-oauth/CodexOAuthError"

const FILE_MODE = 0o600
const DIR_MODE = 0o700

const ensureDirectory = (path: string): void => {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true, mode: DIR_MODE })
  }

  chmodSync(path, DIR_MODE)
}

const sanitizeProfileId = (profileId: string): string => {
  return profileId.trim().replace(/[^a-zA-Z0-9._-]/g, "_")
}

export class CodexProfileStore {
  private readonly cache = new Map<string, CodexOAuthStoredProfile>()

  constructor(private readonly storagePath: string) {}

  listProfiles(): string[] {
    ensureDirectory(this.storagePath)
    return this.readAllFromDisk().map((item) => item.profileId)
  }

  read(profileId: string): CodexOAuthStoredProfile | undefined {
    const normalized = sanitizeProfileId(profileId)
    const cached = this.cache.get(normalized)
    if (cached) return cached

    const path = this.profilePath(normalized)
    if (!existsSync(path)) {
      return undefined
    }

    let parsed: CodexOAuthStoredProfile
    try {
      parsed = JSON.parse(readFileSync(path, "utf8")) as CodexOAuthStoredProfile
    } catch (error) {
      throw new CodexOAuthError(
        CodexOAuthErrorCode.CORRUPTED_STORAGE,
        `Corrupted OAuth profile storage for '${profileId}'`,
        error
      )
    }

    this.assertStoredProfile(parsed, profileId)
    this.cache.set(normalized, parsed)
    return parsed
  }

  save(
    profileId: string,
    tokenSet: CodexOAuthTokenSet
  ): CodexOAuthStoredProfile {
    const normalized = sanitizeProfileId(profileId)
    ensureDirectory(this.storagePath)

    const previous = this.read(normalized)
    const now = Date.now()
    const profile: CodexOAuthStoredProfile = {
      provider: "openai-codex",
      profileId: normalized,
      createdAtUnixMs: previous?.createdAtUnixMs ?? now,
      updatedAtUnixMs: now,
      tokenSet,
    }

    const path = this.profilePath(normalized)
    const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(tempPath, JSON.stringify(profile, null, 2), {
      mode: FILE_MODE,
    })
    chmodSync(tempPath, FILE_MODE)
    renameSync(tempPath, path)
    chmodSync(path, FILE_MODE)

    this.cache.set(normalized, profile)
    return profile
  }

  delete(profileId: string): boolean {
    const normalized = sanitizeProfileId(profileId)
    const path = this.profilePath(normalized)
    this.cache.delete(normalized)

    if (!existsSync(path)) return false
    rmSync(path, { force: true })
    return true
  }

  clearMemoryCache(profileId?: string): void {
    if (!profileId) {
      this.cache.clear()
      return
    }

    this.cache.delete(sanitizeProfileId(profileId))
  }

  private readAllFromDisk(): CodexOAuthStoredProfile[] {
    ensureDirectory(this.storagePath)
    return readdirSync(this.storagePath)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => this.read(fileName.replace(/\.json$/g, "")))
      .filter((item): item is CodexOAuthStoredProfile => Boolean(item))
  }

  private profilePath(profileId: string): string {
    ensureDirectory(dirname(this.storagePath))
    return join(this.storagePath, `${sanitizeProfileId(profileId)}.json`)
  }

  private assertStoredProfile(
    value: CodexOAuthStoredProfile,
    requestedProfileId: string
  ): void {
    if (
      value?.provider !== "openai-codex" ||
      !value?.profileId ||
      typeof value?.tokenSet?.accessToken !== "string" ||
      typeof value?.tokenSet?.refreshToken !== "string" ||
      !Number.isFinite(value?.tokenSet?.expiresAtUnixMs)
    ) {
      throw new CodexOAuthError(
        CodexOAuthErrorCode.CORRUPTED_STORAGE,
        `Invalid OAuth profile structure for '${requestedProfileId}'`
      )
    }
  }
}
