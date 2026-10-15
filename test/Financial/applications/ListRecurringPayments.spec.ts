import { ListRecurringPayments } from "@/Financial/applications/recurringPayments/ListRecurringPayments"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"

const base = {
  churchId: "church-1",
  financialConceptId: "concept-1",
  costCenterId: "cost-center-1",
  name: "Energy",
  dayOfMonth: 10,
  status: "ACTIVE" as const,
}

function recurrence(
  overrides: Partial<ReturnType<RecurringPayments["toPrimitives"]>> = {}
) {
  return RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    type: "FIXED",
    amount: 742.83,
    ...base,
    ...overrides,
  })
}

function record(status: "PENDING" | "CLEARED" | "RECONCILED" | "VOID") {
  return {
    getRecurringPaymentId: () => "recurring-1",
    isSettled: () => status === "CLEARED" || status === "RECONCILED",
  }
}

function build(
  payments: RecurringPayments[],
  records: ReturnType<typeof record>[]
) {
  return new ListRecurringPayments(
    { many: jest.fn().mockResolvedValue(payments) } as never,
    {
      listRecurringPaymentsForChurch: jest.fn().mockResolvedValue(records),
    } as never
  )
}

describe("ListRecurringPayments", () => {
  it("derives PAID from a settled FinancialRecord for the requested competence", async () => {
    const service = build([recurrence()], [record("RECONCILED")])
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]).toMatchObject({
      recurringPaymentId: "recurring-1",
      competence: "2026-10",
      competenceStatus: "PAID",
    })
  })

  it("treats a cleared record as settled", async () => {
    const service = build([recurrence()], [record("CLEARED")])
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("PAID")
  })

  it("does not treat a declared-but-unsettled record as paid", async () => {
    const service = build([recurrence()], [record("PENDING")])
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("AWAITING_RECONCILIATION")
  })

  it("derives pending when no FinancialRecord or active payment exists", async () => {
    const service = build([recurrence({ dayOfMonth: 1 })], [])
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("PENDING")
  })

  it("lets an active payment status override the derived pending state", async () => {
    const currentPayment = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      paymentMethod: "BILL" as const,
      amount: 742.83,
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "BLOCKED" as const,
      providerStatus: "BLOCKED",
      updatedAt: new Date("2026-10-01T10:01:00Z"),
    }
    const service = build([recurrence({ currentPayment })], [])
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("BLOCKED")
  })

  it("marks an inactive recurrence as inactive even when it has a record", async () => {
    const service = build(
      [recurrence({ status: "INACTIVE" })],
      [record("RECONCILED")]
    )
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("INACTIVE")
  })

  it("derives upcoming for a future due date", async () => {
    const service = build([recurrence({ dayOfMonth: 28 })], [])
    const result = await service.execute("church-1", "2999-12")

    expect(result[0]?.competenceStatus).toBe("UPCOMING")
  })
})
