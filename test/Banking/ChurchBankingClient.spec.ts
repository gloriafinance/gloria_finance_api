import { ChurchBankingClient } from "@/Banking/infrastructure/church-banking/ChurchBankingClient.ts"
import type { ConnectExternalAccountResponse } from "@/Banking/domain"

type ConnectResponseParser = {
  parseConnectExternalAccountResponse(
    value: unknown
  ): ConnectExternalAccountResponse
}

describe("ChurchBankingClient", () => {
  it("accepts the complete external-account connection response", () => {
    const parser = new ChurchBankingClient() as unknown as ConnectResponseParser

    const response = parser.parseConnectExternalAccountResponse({
      accountId: "account-1",
      externalAccountId: "church-123",
      status: "ACTIVE",
      connectionMode: "EXTERNAL_API_KEY",
      accountNumber: {
        agency: "0001",
        account: "6752296",
        accountDigit: "1",
      },
      availableBalanceInCents: 12345,
    })

    expect(response).toEqual({
      accountId: "account-1",
      externalAccountId: "church-123",
      status: "ACTIVE",
      connectionMode: "EXTERNAL_API_KEY",
      accountNumber: {
        codeBank: "461",
        agency: "0001",
        account: "6752296",
        accountDigit: "1",
      },
      availableBalanceInCents: 12345,
    })
  })
})
