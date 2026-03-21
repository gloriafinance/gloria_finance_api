import { createHash, randomBytes } from "node:crypto"

const base64Url = (input: Buffer): string =>
  input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")

export const generateCodeVerifier = (): string => {
  return base64Url(randomBytes(48))
}

export const generateCodeChallenge = (codeVerifier: string): string => {
  return base64Url(createHash("sha256").update(codeVerifier).digest())
}

export const generateRandomState = (): string => {
  return base64Url(randomBytes(24))
}
