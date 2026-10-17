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
}

export type CreateBillPaymentInput = {
  externalAccountId: string
  identificationField: string
  description: string
  externalReference: string
}

/**
 * How a boleto is identified. church-banking reads it either from the typed line
 * or from the barcode, so exactly one of the two is sent.
 */
export type BillIdentificationInput =
  | { identificationField: string; barCode?: never }
  | { barCode: string; identificationField?: never }

export type SimulateBillInput = {
  externalAccountId: string
} & BillIdentificationInput

export type BillSimulationBankSlip = {
  identificationField?: string | null
  valueInCents?: number | null
  originalValueInCents?: number | null
  dueDate?: string | null
  companyName?: string | null
  bank?: string | null
  beneficiaryCpfCnpj?: string | null
  beneficiaryName?: string | null
  allowChangeValue?: boolean | null
  minValueInCents?: number | null
  maxValueInCents?: number | null
  discountValueInCents?: number | null
  interestValueInCents?: number | null
  fineValueInCents?: number | null
  totalDiscountValueInCents?: number | null
  totalAdditionalValueInCents?: number | null
  isOverdue?: boolean | null
}

/**
 * What the provider read from the boleto. Every value comes from Asaas through
 * church-banking; this service never derives or recalculates it locally.
 */
export type BillSimulation = {
  minimumScheduleDate?: string | null
  feeInCents?: number | null
  bankSlip?: BillSimulationBankSlip | null
}

/** States church-banking reports for a PIX transfer. */
export type ChurchBankingPixTransferStatus =
  "PENDING" | "IN_BANK_PROCESSING" | "BLOCKED" | "DONE" | "FAILED" | "CANCELLED"

type ChurchBankingPixTransferBase = {
  externalAccountId: string
  externalReference: string
  amountInCents: number
  pixKey: string
  pixKeyType: CreatePixTransferInput["pixKeyType"]
  description: string
}

/**
 * church-banking answers the public PIX transfer per state, so only a
 * provider-confirmed operation carries the receipt and the failure code.
 */
export type ChurchBankingPixTransferResponse =
  | (ChurchBankingPixTransferBase & { status: "RESERVED" | "CREATING" })
  | (ChurchBankingPixTransferBase & {
      status: ChurchBankingPixTransferStatus
      providerTransferId: string
      transactionReceiptUrl: string | null
      failureCode?: string
    })
  | (ChurchBankingPixTransferBase & {
      status: "CREATION_FAILED" | "CREATION_UNKNOWN"
      errorCode: string
    })

/** States church-banking reports for a bill payment. */
export type ChurchBankingBillPaymentStatus =
  "PENDING" | "BANK_PROCESSING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED"

type ChurchBankingBillPaymentBase = {
  externalAccountId: string
  externalReference: string
  identificationField: string
  description: string
}

/**
 * The amount is provider-owned: it only exists once Asaas read the boleto, so
 * the states that precede that answer do not carry it.
 */
export type ChurchBankingBillPaymentResponse =
  | (ChurchBankingBillPaymentBase & { status: "RESERVED" | "CREATING" })
  | (ChurchBankingBillPaymentBase & {
      status: ChurchBankingBillPaymentStatus
      valueInCents: number
      providerBillId: string
      paymentDate: string | null
      transactionReceiptUrl: string | null
      failureCode?: string
    })
  | (ChurchBankingBillPaymentBase & {
      status: "CREATION_FAILED" | "CREATION_UNKNOWN"
      errorCode: string
    })

export interface IChurchBankingClient {
  connectExternalAccount(
    input: ConnectExternalAccountInput
  ): Promise<ConnectExternalAccountResponse>

  createStaticPix(input: CreateStaticPixInput): Promise<StaticPixResponse>

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResponse>

  createPixTransfer(
    input: CreatePixTransferInput
  ): Promise<ChurchBankingPixTransferResponse>

  createBillPayment(
    input: CreateBillPaymentInput
  ): Promise<ChurchBankingBillPaymentResponse>

  simulateBill(input: SimulateBillInput): Promise<BillSimulation>
}
