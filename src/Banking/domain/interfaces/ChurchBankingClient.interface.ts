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

export interface IChurchBankingClient {
  connectExternalAccount(
    input: ConnectExternalAccountInput
  ): Promise<ConnectExternalAccountResponse>

  createStaticPix(input: CreateStaticPixInput): Promise<StaticPixResponse>

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResponse>
}
