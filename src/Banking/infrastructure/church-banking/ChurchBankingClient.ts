import type {
  ConnectExternalAccountInput,
  ConnectExternalAccountResponse,
  CreateStaticPixInput,
  IChurchBankingClient,
  StaticPixResponse,
} from "@/Banking/domain"
import {
  CompactEncrypt,
  importJWK,
  type JWK,
  type KeyLike,
  SignJWT,
} from "jose"
import { createHash, randomUUID } from "node:crypto"
import { churchBankingSigningKeyProvider } from "./ChurchBankingSigningKey.provider"

const TOKEN_LIFETIME_SECONDS = 120
const JWKS_CACHE_MS = 5 * 60 * 1000

type ChurchBankingCommand<TPayload> = {
  path: string
  payload: TPayload
}

type EncryptionKey = {
  key: KeyLike
  kid: string
  expiresAt: number
}

export class ChurchBankingClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(`church-banking request failed with ${status} (${code})`)
    this.name = "ChurchBankingClientError"
  }
}

export class ChurchBankingClient implements IChurchBankingClient {
  private encryptionKey?: EncryptionKey

  async createStaticPix(
    input: CreateStaticPixInput
  ): Promise<StaticPixResponse> {
    const response = await this.execute<CreateStaticPixInput>({
      path: "/api/pix/qr-codes/static",
      payload: input,
    })

    return {
      pixQrCodeId: (response as any).pixQrCodeId,
      copyPaste: (response as any).copyPaste,
      encodedImage: (response as any).encodedImage,
    }
  }

  async connectExternalAccount(
    input: ConnectExternalAccountInput
  ): Promise<ConnectExternalAccountResponse> {
    const response = await this.execute<ConnectExternalAccountInput>({
      path: "/api/accounts/connect",
      payload: input,
    })

    return this.parseConnectExternalAccountResponse(response)
  }

  private async execute<TPayload>(
    command: ChurchBankingCommand<TPayload>
  ): Promise<unknown> {
    const config = this.config()
    this.assertPath(command.path)

    const encryption = await this.getEncryptionKey(config.baseUrl)
    const plaintext = new TextEncoder().encode(JSON.stringify(command.payload))
    const jwe = await new CompactEncrypt(plaintext)
      .setProtectedHeader({
        alg: "ECDH-ES",
        enc: "A256GCM",
        kid: encryption.kid,
      })
      .encrypt(encryption.key)

    const body = JSON.stringify({ jwe })
    const bodyHash = createHash("sha256").update(body).digest("base64url")
    const signing = await churchBankingSigningKeyProvider.get()
    const now = Math.floor(Date.now() / 1000)

    const token = await new SignJWT({
      method: "POST",
      path: command.path,
      bodyHash,
    })
      .setProtectedHeader({ alg: "ES256", kid: signing.keyId, typ: "JWT" })
      .setIssuer(config.issuer)
      .setAudience("CHURCH_BANKING")
      .setSubject(config.clientCode)
      .setJti(randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + TOKEN_LIFETIME_SECONDS)
      .sign(signing.privateKey)

    const response = await fetch(`${config.baseUrl}${command.path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body,
    })

    const responseBody = await this.readJson(response)

    if (!response.ok) {
      const code =
        typeof responseBody === "object" &&
        responseBody !== null &&
        "code" in responseBody &&
        typeof responseBody.code === "string"
          ? responseBody.code
          : "CHURCH_BANKING_REQUEST_FAILED"
      throw new ChurchBankingClientError(response.status, code)
    }

    return responseBody
  }

  private parseConnectExternalAccountResponse(
    value: unknown
  ): ConnectExternalAccountResponse {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      !("accountId" in value) ||
      !("externalAccountId" in value) ||
      !("status" in value) ||
      !("connectionMode" in value) ||
      !("accountNumber" in value) ||
      !("availableBalanceInCents" in value) ||
      typeof value.accountId !== "string" ||
      value.accountId.trim() === "" ||
      typeof value.externalAccountId !== "string" ||
      value.externalAccountId.trim() === "" ||
      value.status !== "ACTIVE" ||
      value.connectionMode !== "EXTERNAL_API_KEY" ||
      typeof value.accountNumber !== "object" ||
      value.accountNumber === null ||
      Array.isArray(value.accountNumber) ||
      !("agency" in value.accountNumber) ||
      !("account" in value.accountNumber) ||
      !("accountDigit" in value.accountNumber) ||
      typeof value.accountNumber.agency !== "string" ||
      value.accountNumber.agency.trim() === "" ||
      typeof value.accountNumber.account !== "string" ||
      value.accountNumber.account.trim() === "" ||
      typeof value.accountNumber.accountDigit !== "string" ||
      value.accountNumber.accountDigit.trim() === "" ||
      typeof value.availableBalanceInCents !== "number" ||
      !Number.isSafeInteger(value.availableBalanceInCents)
    ) {
      throw new ChurchBankingClientError(502, "CHURCH_BANKING_INVALID_RESPONSE")
    }

    return {
      accountId: value.accountId,
      externalAccountId: value.externalAccountId,
      status: value.status,
      connectionMode: value.connectionMode,
      accountNumber: {
        codeBank: "461",
        agency: value.accountNumber.agency,
        account: value.accountNumber.account,
        accountDigit: value.accountNumber.accountDigit,
      },
      availableBalanceInCents: value.availableBalanceInCents,
    }
  }

  private config() {
    const baseUrl = process.env.CHURCH_BANKING_BASE_URL?.replace(/\/$/, "")
    const issuer = process.env.CHURCH_BANKING_CLIENT_ISSUER
    const clientCode = process.env.CHURCH_BANKING_CLIENT_CODE

    if (!baseUrl || !issuer || !clientCode) {
      throw new Error(
        "CHURCH_BANKING_BASE_URL, CHURCH_BANKING_CLIENT_ISSUER and CHURCH_BANKING_CLIENT_CODE are required"
      )
    }

    return { baseUrl, issuer, clientCode }
  }

  private assertPath(path: string) {
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new Error(
        "church-banking command path must be an absolute API path"
      )
    }
  }

  private async getEncryptionKey(baseUrl: string): Promise<EncryptionKey> {
    if (this.encryptionKey && this.encryptionKey.expiresAt > Date.now()) {
      return this.encryptionKey
    }

    const response = await fetch(`${baseUrl}/.well-known/jwks.json`, {
      headers: { accept: "application/json" },
    })
    if (!response.ok) {
      throw new ChurchBankingClientError(
        response.status,
        "CHURCH_BANKING_JWKS_UNAVAILABLE"
      )
    }

    const body = (await response.json()) as { keys?: JWK[] }
    const jwk = body.keys?.find(
      (candidate) =>
        candidate.kty === "EC" &&
        candidate.crv === "P-256" &&
        candidate.alg === "ECDH-ES" &&
        candidate.use === "enc" &&
        typeof candidate.kid === "string" &&
        candidate.kid !== ""
    )

    if (!jwk || typeof jwk.kid !== "string") {
      throw new ChurchBankingClientError(
        503,
        "CHURCH_BANKING_ENCRYPTION_KEY_UNAVAILABLE"
      )
    }

    const key = (await importJWK(jwk, "ECDH-ES")) as KeyLike
    this.encryptionKey = {
      key,
      kid: jwk.kid,
      expiresAt: Date.now() + JWKS_CACHE_MS,
    }

    return this.encryptionKey
  }

  private async readJson(response: Response): Promise<unknown> {
    const text = await response.text()
    if (text === "") return undefined

    try {
      return JSON.parse(text)
    } catch {
      throw new ChurchBankingClientError(502, "CHURCH_BANKING_INVALID_RESPONSE")
    }
  }
}
