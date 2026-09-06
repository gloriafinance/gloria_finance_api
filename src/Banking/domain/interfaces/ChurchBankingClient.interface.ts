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

export interface IChurchBankingClient {
  connectExternalAccount(
    input: ConnectExternalAccountInput
  ): Promise<ConnectExternalAccountResponse>

  createStaticPix(input: CreateStaticPixInput): Promise<StaticPixResponse>
}
