import { CreateAvailabilityAccount } from "@/FinanceConfig/applications/availabilityAccount/CreateAvailabilityAccount"
import {
  AccountType,
  type IAvailabilityAccountRepository,
} from "@/FinanceConfig/domain"

describe("CreateAvailabilityAccount", () => {
  it("persists the supplied initial balance", async () => {
    const upsert = jest.fn().mockResolvedValue(undefined)
    const repository = { upsert } as unknown as IAvailabilityAccountRepository

    await new CreateAvailabilityAccount(repository).execute({
      churchId: "church-1",
      accountName: "Conta Asaas",
      active: true,
      accountType: AccountType.BANK,
      symbol: "R$",
      source: {},
      balance: 0.41,
    })

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0][0].toPrimitives()).toMatchObject({
      balance: 0.41,
    })
  })
})
