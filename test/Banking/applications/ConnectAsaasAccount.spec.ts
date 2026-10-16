import { ConnectProviderBankAccount } from "@/Banking/applications/ConnectProviderBankAccount.ts"
import type {
  ConnectExternalAccountResponse,
  IBankRepository,
  IChurchBankingClient,
} from "@/Banking/domain"
import { Provider } from "@/Banking/domain/enums/Provider.enum"
import type { Church, IChurchRepository } from "@/Church/domain"

describe("ConnectProviderBankAccount", () => {
  it("forwards the church id and API key through the generic banking port", async () => {
    const connectExternalAccount = jest.fn()
    const client = {
      connectExternalAccount,
    } as unknown as IChurchBankingClient

    const response: ConnectExternalAccountResponse = {
      accountId: "account-1",
      externalAccountId: "church-123",
      status: "ACTIVE",
      connectionMode: "EXTERNAL_API_KEY",
      accountNumber: {
        codeBank: "001",
        agency: "1234",
        account: "56789",
        accountDigit: "0",
      },
      availableBalanceInCents: 0,
    }
    connectExternalAccount.mockResolvedValue(response)

    const upsert = jest.fn().mockResolvedValue(undefined)
    const bankRepository = {
      upsert,
      findById: jest.fn(),
      all: jest.fn(),
    } as unknown as IBankRepository
    const church = {
      getChurchId: () => "church-123",
    } as unknown as Church
    const churchRepository = {
      one: jest.fn().mockResolvedValue(church),
    } as unknown as IChurchRepository

    const result = await new ConnectProviderBankAccount(
      bankRepository,
      churchRepository,
      client
    ).execute({
      churchId: "church-123",
      apiKey: "$aact_secret",
      connectionName: "Conta Asaas",
    })

    expect(connectExternalAccount).toHaveBeenCalledWith({
      externalAccountId: "church-123",
      apiKey: "$aact_secret",
    })
    // The connected bank is persisted flagged with the provider that debits it.
    expect(upsert).toHaveBeenCalledWith(result.bank)
    expect(result.bank.isConnectedTo(Provider.ASAAS)).toBe(true)
    expect(result.account).toEqual(response)
  })
})
