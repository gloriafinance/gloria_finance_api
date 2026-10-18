import { describe, expect, it, jest } from "@jest/globals"
import { AccountType } from "@/FinanceConfig/domain/enums/AccountType.enum"
import { Provider } from "@/Banking/domain/enums/Provider.enum"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { DecodeRecurringPaymentPixQr } from "./DecodeRecurringPaymentPixQr"

function build(
  options: { accountAvailable?: boolean; asaasActive?: boolean } = {}
) {
  const recurring = RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Alquiler",
    type: "FIXED",
    amount: 100,
    dayOfMonth: 10,
    status: "ACTIVE",
  })
  const recurringPaymentsRepository = {
    one: jest.fn(async () => recurring),
  }
  const availabilityAccountRepository = {
    one: jest.fn(async () =>
      options.accountAvailable === false
        ? undefined
        : {
            getType: () => AccountType.BANK,
            getSource: () => ({ bankId: "bank-1" }),
          }
    ),
  }
  const bankRepository = {
    findById: jest.fn(async () => ({
      isActive: () => options.asaasActive !== false,
      isConnectedTo: (provider: Provider) => provider === Provider.ASAAS,
    })),
  }
  const churchBankingClient = {
    decodePixQr: jest.fn(async () => ({ amountInCents: 15000 })),
  }
  const useCase = new DecodeRecurringPaymentPixQr(
    recurringPaymentsRepository as never,
    availabilityAccountRepository as never,
    bankRepository as never,
    churchBankingClient as never
  )

  return {
    useCase,
    recurring,
    recurringPaymentsRepository,
    availabilityAccountRepository,
    churchBankingClient,
  }
}

describe("DecodeRecurringPaymentPixQr", () => {
  it("uses the authenticated church and selected account without creating a payment", async () => {
    const {
      useCase,
      recurring,
      recurringPaymentsRepository,
      churchBankingClient,
    } = build()

    await expect(
      useCase.execute(
        "church-1",
        "recurring-1",
        "availability-1",
        "pix-original"
      )
    ).resolves.toEqual({ amountInCents: 15000 })

    expect(recurringPaymentsRepository.one).toHaveBeenCalledWith({
      recurringPaymentId: "recurring-1",
      churchId: "church-1",
      status: "ACTIVE",
    })
    expect(churchBankingClient.decodePixQr).toHaveBeenCalledWith({
      externalAccountId: recurring.getChurchId(),
      payload: "pix-original",
    })
    expect(recurring.getCurrentPayment()).toBeUndefined()
  })

  it("rejects an account outside the authenticated church before calling banking", async () => {
    const { useCase, availabilityAccountRepository, churchBankingClient } =
      build({
        accountAvailable: false,
      })

    await expect(
      useCase.execute("church-1", "recurring-1", "other-church-account", "pix")
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE",
    })
    expect(availabilityAccountRepository.one).toHaveBeenCalledWith({
      availabilityAccountId: "other-church-account",
      churchId: "church-1",
      active: true,
    })
    expect(churchBankingClient.decodePixQr).not.toHaveBeenCalled()
  })

  it("rejects an inactive Asaas bank before calling banking", async () => {
    const { useCase, churchBankingClient } = build({ asaasActive: false })

    await expect(
      useCase.execute("church-1", "recurring-1", "availability-1", "pix")
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE",
    })
    expect(churchBankingClient.decodePixQr).not.toHaveBeenCalled()
  })
})
