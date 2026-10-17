import type {
  BillSimulation,
  BillSimulationBankSlip,
  ChurchBankingBillPaymentResponse,
  ChurchBankingBillPaymentStatus,
  ChurchBankingPixTransferResponse,
  ChurchBankingPixTransferStatus,
  ConnectExternalAccountInput,
  ConnectExternalAccountResponse,
  CreatePaymentInput,
  CreatePaymentResponse,
  CreateBillPaymentInput,
  CreatePixTransferInput,
  CreateStaticPixInput,
  IChurchBankingClient,
  SimulateBillInput,
  StaticPixResponse,
} from "@/Banking/domain"
import { ChurchBankingClientError } from "@/Banking/domain"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { CompactEncrypt, importJWK, type JWK, KeyLike, SignJWT } from "jose"
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

export class ChurchBankingClient implements IChurchBankingClient {
  private logger = Logger(ChurchBankingClient.name)
  private encryptionKey?: EncryptionKey

  async createPayment(
    input: CreatePaymentInput
  ): Promise<CreatePaymentResponse> {
    this.logger.info(`Requesting create payment pix: ${JSON.stringify(input)}`)

    return (await this.execute<CreatePaymentInput>({
      path: "/api/payments",
      payload: input,
    })) as CreatePaymentResponse
  }

  async createPixTransfer(
    input: CreatePixTransferInput
  ): Promise<ChurchBankingPixTransferResponse> {
    const response = await this.execute<CreatePixTransferInput>({
      path: "/api/pix-transfers",
      payload: input,
    })
    return this.parsePixTransferResponse(response, input)
  }

  async createBillPayment(
    input: CreateBillPaymentInput
  ): Promise<ChurchBankingBillPaymentResponse> {
    const response = await this.execute<CreateBillPaymentInput>({
      path: "/api/bill-payments",
      payload: input,
    })
    return this.parseBillPaymentResponse(response, input)
  }

  async simulateBill(input: SimulateBillInput): Promise<BillSimulation> {
    const response = await this.execute<SimulateBillInput>({
      path: "/api/bill-payments/simulate",
      payload: input,
    })
    return this.parseBillSimulationResponse(response)
  }

  async createStaticPix(
    input: CreateStaticPixInput
  ): Promise<StaticPixResponse> {
    this.logger.info(`Creating static pix for concept. `, input)

    const response = await this.execute<{
      externalAccountId: string
      externalReference: string
      description: string
    }>({
      path: "/api/pix/qr-codes/static",
      payload: {
        externalReference: input.referenceId,
        externalAccountId: input.churchId,
        description: input.description,
      },
    })

    this.logger.info(
      `Static pix created for concept. ${input.churchId} - ${input.referenceId}`,
      response as any
    )

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

    this.logger.info(`Fetching: ${config.baseUrl}${command.path}`)

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

  private parsePixTransferResponse(
    value: unknown,
    expected: CreatePixTransferInput
  ): ChurchBankingPixTransferResponse {
    const result = responseData(value)
    if (
      result.externalAccountId !== expected.externalAccountId ||
      result.externalReference !== expected.externalReference ||
      result.amountInCents !== expected.amountInCents ||
      result.pixKey !== expected.pixKey ||
      result.pixKeyType !== expected.pixKeyType ||
      result.description !== expected.description
    ) {
      throw invalidResponse()
    }

    const base = {
      externalAccountId: expected.externalAccountId,
      externalReference: expected.externalReference,
      amountInCents: expected.amountInCents,
      pixKey: expected.pixKey,
      pixKeyType: expected.pixKeyType,
      description: expected.description,
    }
    const status = result.status
    if (status === "RESERVED" || status === "CREATING") {
      return { ...base, status }
    }
    if (status === "CREATION_FAILED" || status === "CREATION_UNKNOWN") {
      if (!isNonBlankString(result.errorCode)) throw invalidResponse()
      return { ...base, status, errorCode: result.errorCode }
    }
    if (!isPixTransferStatus(status)) throw invalidResponse()
    if (
      !isNonBlankString(result.providerTransferId) ||
      !isNullableString(result.transactionReceiptUrl) ||
      !isOptionalString(result.failureCode)
    ) {
      throw invalidResponse()
    }

    return {
      ...base,
      status,
      providerTransferId: result.providerTransferId,
      transactionReceiptUrl: result.transactionReceiptUrl,
      ...(typeof result.failureCode === "string"
        ? { failureCode: result.failureCode }
        : {}),
    }
  }

  private parseBillPaymentResponse(
    value: unknown,
    expected: CreateBillPaymentInput
  ): ChurchBankingBillPaymentResponse {
    const result = responseData(value)
    if (
      result.externalAccountId !== expected.externalAccountId ||
      result.externalReference !== expected.externalReference ||
      result.identificationField !== expected.identificationField ||
      result.description !== expected.description
    ) {
      throw invalidResponse()
    }

    const base = {
      externalAccountId: expected.externalAccountId,
      externalReference: expected.externalReference,
      identificationField: expected.identificationField,
      description: expected.description,
    }
    const status = result.status
    if (status === "RESERVED" || status === "CREATING") {
      return { ...base, status }
    }
    if (status === "CREATION_FAILED" || status === "CREATION_UNKNOWN") {
      if (!isNonBlankString(result.errorCode)) throw invalidResponse()
      return { ...base, status, errorCode: result.errorCode }
    }
    if (!isBillPaymentStatus(status)) throw invalidResponse()
    // The amount is provider-owned, so a confirmed bill must carry the value
    // Asaas read. Without it the debit could never be booked.
    if (
      !isPositiveInteger(result.valueInCents) ||
      !isNonBlankString(result.providerBillId) ||
      !isNullableString(result.paymentDate) ||
      !isNullableString(result.transactionReceiptUrl) ||
      !isOptionalString(result.failureCode)
    ) {
      throw invalidResponse()
    }

    return {
      ...base,
      status,
      valueInCents: result.valueInCents,
      providerBillId: result.providerBillId,
      paymentDate: result.paymentDate,
      transactionReceiptUrl: result.transactionReceiptUrl,
      ...(typeof result.failureCode === "string"
        ? { failureCode: result.failureCode }
        : {}),
    }
  }

  private parseBillSimulationResponse(value: unknown): BillSimulation {
    const result = responseData(value)
    const bankSlip = result.bankSlip

    return {
      minimumScheduleDate: optionalString(result.minimumScheduleDate),
      feeInCents: optionalInteger(result.feeInCents),
      bankSlip:
        bankSlip === undefined || bankSlip === null
          ? bankSlip
          : parseBankSlip(bankSlip),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function responseData(value: unknown): Record<string, unknown> {
  const data = isRecord(value) && "data" in value ? value.data : undefined
  if (!isRecord(data)) throw invalidResponse()
  return data
}

function invalidResponse(): ChurchBankingClientError {
  return new ChurchBankingClientError(502, "CHURCH_BANKING_INVALID_RESPONSE")
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== ""
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string"
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined || value === null || typeof value === "string")
    return value
  throw invalidResponse()
}

function optionalInteger(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return value
  if (typeof value === "number" && Number.isSafeInteger(value)) return value
  throw invalidResponse()
}

function optionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined || value === null || typeof value === "boolean")
    return value
  throw invalidResponse()
}

function parseBankSlip(value: unknown): BillSimulationBankSlip {
  if (!isRecord(value)) throw invalidResponse()
  return {
    identificationField: optionalString(value.identificationField),
    valueInCents: optionalInteger(value.valueInCents),
    originalValueInCents: optionalInteger(value.originalValueInCents),
    dueDate: optionalString(value.dueDate),
    companyName: optionalString(value.companyName),
    bank: optionalString(value.bank),
    beneficiaryCpfCnpj: optionalString(value.beneficiaryCpfCnpj),
    beneficiaryName: optionalString(value.beneficiaryName),
    allowChangeValue: optionalBoolean(value.allowChangeValue),
    minValueInCents: optionalInteger(value.minValueInCents),
    maxValueInCents: optionalInteger(value.maxValueInCents),
    discountValueInCents: optionalInteger(value.discountValueInCents),
    interestValueInCents: optionalInteger(value.interestValueInCents),
    fineValueInCents: optionalInteger(value.fineValueInCents),
    totalDiscountValueInCents: optionalInteger(value.totalDiscountValueInCents),
    totalAdditionalValueInCents: optionalInteger(
      value.totalAdditionalValueInCents
    ),
    isOverdue: optionalBoolean(value.isOverdue),
  }
}

const PIX_TRANSFER_STATUSES: readonly ChurchBankingPixTransferStatus[] = [
  "PENDING",
  "IN_BANK_PROCESSING",
  "BLOCKED",
  "DONE",
  "FAILED",
  "CANCELLED",
]

function isPixTransferStatus(
  value: unknown
): value is ChurchBankingPixTransferStatus {
  return (
    typeof value === "string" &&
    (PIX_TRANSFER_STATUSES as readonly string[]).includes(value)
  )
}

const BILL_PAYMENT_STATUSES: readonly ChurchBankingBillPaymentStatus[] = [
  "PENDING",
  "BANK_PROCESSING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]

function isBillPaymentStatus(
  value: unknown
): value is ChurchBankingBillPaymentStatus {
  return (
    typeof value === "string" &&
    (BILL_PAYMENT_STATUSES as readonly string[]).includes(value)
  )
}
