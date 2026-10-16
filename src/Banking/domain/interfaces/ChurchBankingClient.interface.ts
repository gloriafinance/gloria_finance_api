import type { ConnectExternalAccountResponse } from "@/Banking/domain/requests/ConnectExternalAccount.request"

export type ConnectExternalAccountInput = {
  externalAccountId: string
  apiKey: string
}

export type CreateStaticPixInput = {
  churchId: string
  referenceId: string
  description: string
}

export type StaticPixResponse = {
  pixQrCodeId: string
  copyPaste: string
  encodedImage: string
}

export type CreatePaymentInput = {
  externalAccountId: string
  externalReference: string
  principalAmountInCents: number
  dueDate: string
  description?: string
  customer: {
    name: string
    cpfCnpj: string
  }
}

export type CreatePaymentResponse = {
  paymentId: string
  externalAccountId: string
  externalReference: string
  status: string
  principalAmountInCents: number
  transactionFeeInCents: number
  platformFeeInCents: number
  chargeAmountInCents: number
  providerPaymentId?: string
  pix?: {
    copyPaste: string
    encodedImage?: string
    expirationDate: string
  }
  errorCode?: string
}

export type CreatePixTransferInput = {
  externalAccountId: string
  amountInCents: number
  pixKey: string
  pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP"
  description: string
  externalReference: string
  context: Record<string, unknown>
}

export type CreateBillPaymentInput = {
  externalAccountId: string
  identificationField: string
  description: string
  externalReference: string
  context: Record<string, unknown>
  /**
   * Amount this boleto is expected to charge. Sent so church-banking compares it
   * with the amount read from the line and refuses before calling Asaas, rather
   * than after the debit already exists.
   */
  expectedAmountInCents?: number
}

export type ChurchBankingOutgoingStatus =
  | "RESERVED"
  | "CREATING"
  | "CREATION_UNKNOWN"
  | "CREATION_FAILED"
  /**
   * The operation is alive but not conclusive (the provider is still processing
   * it or analysing its risk). church-banking normalizes its provider's
   * vocabulary, so a PSP rename is not this contract's problem.
   */
  | "PROCESSING"
  | "PENDING"
  | "IN_BANK_PROCESSING"
  | "BLOCKED"
  | "DONE"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"

export type ChurchBankingOutgoingPaymentResponse = {
  externalAccountId: string
  externalReference: string
  status: ChurchBankingOutgoingStatus
  /** Amount the boleto charges, read from the line by church-banking. */
  valueInCents?: number
  context: Record<string, unknown>
  providerTransferId?: string
  providerBillId?: string
  amountInCents?: number
  paymentDate?: string | null
  transactionReceiptUrl?: string | null
  failureCode?: string
  errorCode?: string
}

export interface IChurchBankingClient {
  connectExternalAccount(
    input: ConnectExternalAccountInput
  ): Promise<ConnectExternalAccountResponse>

  createStaticPix(input: CreateStaticPixInput): Promise<StaticPixResponse>

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResponse>

  createPixTransfer(
    input: CreatePixTransferInput
  ): Promise<ChurchBankingOutgoingPaymentResponse>

  createBillPayment(
    input: CreateBillPaymentInput
  ): Promise<ChurchBankingOutgoingPaymentResponse>
}
