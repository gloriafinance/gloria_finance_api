import { ConnectProviderBankAccount } from "@/Banking/applications/ConnectProviderBankAccount.ts"
import type { IChurchBankingClient } from "@/Banking/domain"

describe("ConnectProviderBankAccount", () => {
  it("forwards the church id and API key through the generic banking port", async () => {
    const connectExternalAccount = jest.fn()
    const client = {
      connectExternalAccount,
    } as unknown as IChurchBankingClient
    const response = {
      accountId: "account-1",
      externalAccountId: "church-123",
      status: "ACTIVE" as const,
      connectionMode: "EXTERNAL_API_KEY" as const,
    }
    connectExternalAccount.mockResolvedValue(response)

    const result = await new ConnectProviderBankAccount(client).execute({
      churchId: "church-123",
      apiKey: "$aact_secret",
    })

    expect(connectExternalAccount).toHaveBeenCalledWith({
      externalAccountId: "church-123",
      apiKey: "$aact_secret",
    })
    expect(result).toEqual(response)
  })
})
