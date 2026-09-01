import type {
  ConnectExternalAccountRequest,
  ConnectExternalAccountResponse,
  IChurchBankingClient,
} from "@/Banking/domain"

export class ConnectProviderBankAccount {
  constructor(private readonly churchBankingClient: IChurchBankingClient) {}

  async execute(
    request: ConnectExternalAccountRequest
  ): Promise<ConnectExternalAccountResponse> {
    return await this.churchBankingClient.connectExternalAccount({
      externalAccountId: request.churchId,
      apiKey: request.apiKey,
    })
  }
}
