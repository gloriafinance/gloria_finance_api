import {
  calculateJwkThumbprint,
  exportJWK,
  importJWK,
  type JWK,
  type KeyLike,
} from "jose"

export type ChurchBankingSigningKeys = {
  privateKey: KeyLike
  publicJwk: JWK & {
    alg: "ES256"
    kid: string
    use: "sig"
  }
  keyId: string
}

export class ChurchBankingSigningKeyProvider {
  private cached?: Promise<ChurchBankingSigningKeys>

  get(): Promise<ChurchBankingSigningKeys> {
    this.cached ??= this.load()
    return this.cached
  }

  private async load(): Promise<ChurchBankingSigningKeys> {
    const encoded = process.env.CHURCH_BANKING_SIGNING_PRIVATE_JWK
    if (!encoded) {
      throw new Error("CHURCH_BANKING_SIGNING_PRIVATE_JWK is required")
    }

    let privateJwk: JWK
    try {
      privateJwk = JSON.parse(encoded) as JWK
    } catch {
      throw new Error("CHURCH_BANKING_SIGNING_PRIVATE_JWK must be valid JSON")
    }

    if (
      privateJwk.kty !== "EC" ||
      privateJwk.crv !== "P-256" ||
      typeof privateJwk.d !== "string" ||
      privateJwk.d === ""
    ) {
      throw new Error(
        "CHURCH_BANKING_SIGNING_PRIVATE_JWK must be a P-256 EC private JWK"
      )
    }

    const privateKey = (await importJWK(privateJwk, "ES256")) as KeyLike
    const exported = await exportJWK(privateKey)
    delete exported.d

    const keyId = await calculateJwkThumbprint(exported)

    return {
      privateKey,
      keyId,
      publicJwk: {
        ...exported,
        alg: "ES256",
        kid: keyId,
        use: "sig",
      },
    }
  }
}

export const churchBankingSigningKeyProvider =
  new ChurchBankingSigningKeyProvider()
