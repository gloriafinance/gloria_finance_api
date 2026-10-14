import { ListRecurringPayments } from "@/Financial/applications/recurringPayments/ListRecurringPayments"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"

describe("ListRecurringPayments", () => {
  const recurrence = (
    overrides: Partial<ReturnType<RecurringPayments["toPrimitives"]>> = {}
  ) =>
    RecurringPayments.fromPrimitives({
      recurringPaymentsId: "recurring-1",
      churchId: "church-1",
      financialConceptId: "concept-1",
      name: "Energy",
      type: "FIXED",
      amount: 742.83,
      dayOfMonth: 10,
      payment: { method: "BILL" },
      status: "ACTIVE",
      ...overrides,
    })

  it("derives PAID from FinancialRecord for the requested competence", async () => {
    const recurringPaymentsRepository = {
      many: jest.fn().mockResolvedValue([recurrence()]),
    }
    const financialRecordRepository = {
      listRecurringPaymentsForChurch: jest
        .fn()
        .mockResolvedValue([{ getRecurringPaymentId: () => "recurring-1" }]),
    }

    const result = await new ListRecurringPayments(
      recurringPaymentsRepository as never,
      financialRecordRepository as never
    ).execute("church-1", "2026-10")

    expect(result[0]).toMatchObject({
      recurringPaymentsId: "recurring-1",
      competence: "2026-10",
      competenceStatus: "PAID",
    })
    expect(
      financialRecordRepository.listRecurringPaymentsForChurch
    ).toHaveBeenCalledWith("church-1", "2026-10")
  })

  it("derives pending when no FinancialRecord or active payment exists", async () => {
    const recurringPaymentsRepository = {
      many: jest.fn().mockResolvedValue([recurrence({ dayOfMonth: 1 })]),
    }
    const financialRecordRepository = {
      listRecurringPaymentsForChurch: jest.fn().mockResolvedValue([]),
    }

    const result = await new ListRecurringPayments(
      recurringPaymentsRepository as never,
      financialRecordRepository as never
    ).execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("PENDING")
  })

  it("lets an active payment status override the derived pending state", async () => {
    const currentPayment = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      method: "BILL" as const,
      amount: 742.83,
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "BLOCKED" as const,
      providerStatus: "BLOCKED",
      updatedAt: new Date("2026-10-01T10:01:00Z"),
    }
    const recurringPaymentsRepository = {
      many: jest.fn().mockResolvedValue([recurrence({ currentPayment })]),
    }
    const financialRecordRepository = {
      listRecurringPaymentsForChurch: jest.fn().mockResolvedValue([]),
    }

    const result = await new ListRecurringPayments(
      recurringPaymentsRepository as never,
      financialRecordRepository as never
    ).execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("BLOCKED")
  })
})
