import type { ConnectExternalAccountResponse } from "@/Banking/domain/requests/ConnectExternalAccount.request"

export type ConnectExternalAccountInput = {
  externalAccountId: string
  apiKey: string
}

export interface IChurchBankingClient {
  connectExternalAccount(
    input: ConnectExternalAccountInput
  ): Promise<ConnectExternalAccountResponse>
}
