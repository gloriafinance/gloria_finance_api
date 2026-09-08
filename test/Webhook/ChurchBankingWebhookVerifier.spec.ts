import { createHash, randomUUID } from "node:crypto"
import {
  generateKeyPair,
  SignJWT,
  type KeyLike,
  type JWTVerifyGetKey,
} from "jose"
import {
  ChurchBankingWebhookVerificationError,
  ChurchBankingWebhookVerifier,
} from "@/Webhook/infrastructure/http/ChurchBankingWebhookVerifier.ts"

const PATH = "/webhooks/church-banking"
const BODY = new TextEncoder().encode(
  JSON.stringify({
    id: "event-123",
    type: "BANKING_PAYMENT_UPDATED",
    requestId: "request-123",
  })
)

const originalBaseUrl = process.env.CHURCH_BANKING_BASE_URL
const originalClientCode = process.env.CHURCH_BANKING_CLIENT_CODE

describe("ChurchBankingWebhookVerifier", () => {
  beforeEach(() => {
    process.env.CHURCH_BANKING_BASE_URL = "https://church-banking.example.com"
    process.env.CHURCH_BANKING_CLIENT_CODE = "GLORIA_FINANCE"
  })

  afterAll(() => {
    restoreEnv("CHURCH_BANKING_BASE_URL", originalBaseUrl)
    restoreEnv("CHURCH_BANKING_CLIENT_CODE", originalClientCode)
  })

  it("accepts an ES256 token bound to the exact webhook body", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256")
    const verifier = verifierFor(publicKey)
    const token = await signToken(privateKey, hash(BODY))

    await expect(
      verifier.verify({
        authorization: `Bearer ${token}`,
        method: "POST",
        path: PATH,
        rawBody: BODY,
      })
    ).resolves.toBeUndefined()
  })

  it("rejects a valid token when the raw body was changed", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256")
    const verifier = verifierFor(publicKey)
    const token = await signToken(privateKey, hash(BODY))
    const tamperedBody = new TextEncoder().encode(
      JSON.stringify({ id: "event-999", type: "BANKING_PAYMENT_UPDATED" })
    )

    await expectVerificationError(
      verifier.verify({
        authorization: `Bearer ${token}`,
        method: "POST",
        path: PATH,
        rawBody: tamperedBody,
      }),
      400,
      "CHURCH_BANKING_WEBHOOK_BODY_HASH_INVALID"
    )
  })

  it("rejects a token for another audience", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256")
    const verifier = verifierFor(publicKey)
    const token = await signToken(privateKey, hash(BODY), {
      audience: "OTHER_CLIENT",
    })

    await expectVerificationError(
      verifier.verify({
        authorization: `Bearer ${token}`,
        method: "POST",
        path: PATH,
        rawBody: BODY,
      }),
      401,
      "CHURCH_BANKING_WEBHOOK_UNAUTHORIZED"
    )
  })

  it("rejects a token bound to a different path", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256")
    const verifier = verifierFor(publicKey)
    const token = await signToken(privateKey, hash(BODY), {
      path: "/webhooks/other",
    })

    await expectVerificationError(
      verifier.verify({
        authorization: `Bearer ${token}`,
        method: "POST",
        path: PATH,
        rawBody: BODY,
      }),
      401,
      "CHURCH_BANKING_WEBHOOK_UNAUTHORIZED"
    )
  })

  it("rejects requests without a bearer token", async () => {
    const { publicKey } = await generateKeyPair("ES256")
    const verifier = verifierFor(publicKey)

    await expectVerificationError(
      verifier.verify({
        authorization: undefined,
        method: "POST",
        path: PATH,
        rawBody: BODY,
      }),
      401,
      "CHURCH_BANKING_WEBHOOK_UNAUTHORIZED"
    )
  })
})

function verifierFor(publicKey: KeyLike): ChurchBankingWebhookVerifier {
  const resolver: JWTVerifyGetKey = async () => publicKey
  return new ChurchBankingWebhookVerifier(() => resolver)
}

async function signToken(
  privateKey: KeyLike,
  bodyHash: string,
  overrides: { readonly audience?: string; readonly path?: string } = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  return await new SignJWT({
    method: "POST",
    path: overrides.path ?? PATH,
    bodyHash,
  })
    .setProtectedHeader({ alg: "ES256", kid: "church-banking-signing-key" })
    .setIssuer("CHURCH_BANKING")
    .setAudience(overrides.audience ?? "GLORIA_FINANCE")
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey)
}

function hash(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("base64url")
}

async function expectVerificationError(
  promise: Promise<void>,
  status: number,
  code: string
): Promise<void> {
  try {
    await promise
    throw new Error("Expected ChurchBankingWebhookVerificationError")
  } catch (error) {
    expect(error).toBeInstanceOf(ChurchBankingWebhookVerificationError)
    expect((error as ChurchBankingWebhookVerificationError).status).toBe(status)
    expect((error as ChurchBankingWebhookVerificationError).code).toBe(code)
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}
