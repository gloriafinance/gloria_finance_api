import {
  ListRecurringPayments,
  createdCompetenceOf,
} from "@/Financial/applications/recurringPayments/ListRecurringPayments"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { ObjectId } from "mongodb"

/** ObjectId created at a given instant, so the embedded timestamp is known. */
function idCreatedAt(iso: string): string {
  return ObjectId.createFromTime(
    Math.floor(new Date(iso).getTime() / 1000)
  ).toString()
}

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

function record(
  status: "PENDING" | "CLEARED" | "RECONCILED" | "VOID",
  overrides: {
    date?: Date
    amount?: number
    voucher?: string
    availabilityAccountId?: string
  } = {}
) {
  return {
    getRecurringPaymentId: () => "recurring-1",
    isSettled: () => status === "CLEARED" || status === "RECONCILED",
    getFinancialRecordId: () => "record-1",
    getAmount: () => overrides.amount ?? 742.83,
    getDate: () => overrides.date ?? new Date("2026-10-10T12:00:00Z"),
    getStatus: () => status,
    getAvailabilityAccountId: () =>
      overrides.availabilityAccountId ?? "availability-1",
    getVoucher: () => overrides.voucher,
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

  it("does not treat a void record as paid", async () => {
    const service = build([recurrence()], [record("VOID")])
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("PENDING")
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

  it("keeps a settled competence PAID after the recurrence is deactivated", async () => {
    // History outranks configuration: deactivating stops future commitments, it
    // does not erase a payment already made.
    const service = build(
      [recurrence({ status: "INACTIVE" })],
      [record("RECONCILED")]
    )
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("PAID")
  })

  it("marks an inactive recurrence as inactive when nothing was paid", async () => {
    const service = build([recurrence({ status: "INACTIVE" })], [])
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.competenceStatus).toBe("INACTIVE")
  })

  it("hides a recurrence in a month before it was created", async () => {
    // Created in October; September must not report a commitment that did not
    // exist then.
    const created = recurrence()
    created.assignId(idCreatedAt("2026-10-17T12:00:00Z"))
    const service = build([created], [])

    const result = await service.execute("church-1", "2026-09")

    expect(result).toHaveLength(0)
  })

  it("shows the recurrence in its own creation month", async () => {
    const created = recurrence()
    created.assignId(idCreatedAt("2026-10-17T12:00:00Z"))
    const service = build([created], [])

    const result = await service.execute("church-1", "2026-10")

    expect(result).toHaveLength(1)
  })

  it("shows the recurrence in a month after it was created", async () => {
    const created = recurrence()
    created.assignId(idCreatedAt("2026-10-17T12:00:00Z"))
    const service = build([created], [])

    const result = await service.execute("church-1", "2026-11")

    expect(result).toHaveLength(1)
  })

  it("derives the creation competence in Sao Paulo time", () => {
    // 23:00 UTC on Sep 30 is still September in Sao Paulo (UTC-3).
    expect(createdCompetenceOf(idCreatedAt("2026-09-30T23:00:00Z"))).toBe(
      "2026-09"
    )
    // 02:00 UTC on Oct 1 is Sep 30 in Sao Paulo.
    expect(createdCompetenceOf(idCreatedAt("2026-10-01T02:00:00Z"))).toBe(
      "2026-09"
    )
  })

  it("cannot filter when there is no usable id", () => {
    expect(createdCompetenceOf(undefined)).toBeNull()
    expect(createdCompetenceOf("not-an-object-id")).toBeNull()
  })

  it("keeps a recurrence without an id visible rather than hiding it", async () => {
    // No provenance to compare against, so it must not silently disappear.
    const service = build([recurrence()], [])

    const result = await service.execute("church-1", "2020-01")

    expect(result).toHaveLength(1)
  })

  it("shows a recurrence in a competence before it was ever created", async () => {
    // The month view lists every recurrence with its state for that competence,
    // even months predating the commitment. There is simply no settlement for
    // it, so it reads as pending/upcoming rather than as if it did not exist.
    const service = build([recurrence({ dayOfMonth: 10 })], [])
    const result = await service.execute("church-1", "2026-09")

    expect(result[0]?.competenceStatus).toBe("PENDING")
  })

  it("derives upcoming for a future due date", async () => {
    const service = build([recurrence({ dayOfMonth: 28 })], [])
    const result = await service.execute("church-1", "2999-12")

    expect(result[0]?.competenceStatus).toBe("UPCOMING")
  })

  it("exposes the settlement summary of a paid competence", async () => {
    const service = build(
      [recurrence()],
      [
        record("RECONCILED", {
          amount: 742.83,
          voucher: "https://storage/receipt.pdf",
          date: new Date("2026-10-10T12:00:00Z"),
        }),
      ]
    )

    const result = await service.execute("church-1", "2026-10")

    // The screen explains how it was paid: amount, date, origin account, status
    // and the voucher. History belongs to the financial record.
    expect(result[0]?.settlement).toMatchObject({
      financialRecordId: "record-1",
      amount: 742.83,
      status: "RECONCILED",
      availabilityAccountId: "availability-1",
      voucher: "https://storage/receipt.pdf",
    })
  })

  it("keeps the most recent settled record when a competence has several", async () => {
    const service = build(
      [recurrence()],
      [
        record("CLEARED", {
          amount: 100,
          date: new Date("2026-10-02T12:00:00Z"),
        }),
        record("RECONCILED", {
          amount: 742.83,
          date: new Date("2026-10-09T12:00:00Z"),
        }),
      ]
    )

    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.settlement).toMatchObject({
      amount: 742.83,
      status: "RECONCILED",
    })
  })

  it("exposes the execution state of the requested competence only", async () => {
    const inFlight = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 742.83,
      paymentMethod: "BILL" as const,
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "PROCESSING" as const,
      providerStatus: "PENDING",
      updatedAt: new Date("2026-10-01T12:00:00Z"),
    }

    const service = build([recurrence({ currentPayment: inFlight })], [])

    const same = await service.execute("church-1", "2026-10")
    expect(same[0]?.currentPayment).toMatchObject({
      paymentMethod: "BILL",
      amount: 742.83,
      status: "PROCESSING",
    })
    expect(same[0]?.competenceStatus).toBe("PROCESSING")

    // A failed attempt from another month must not leak into this one.
    const other = await service.execute("church-1", "2026-11")
    expect(other[0]?.currentPayment).toBeUndefined()
  })

  it("sends both amounts when the boleto charges a different value", async () => {
    const mismatched = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 742.83,
      providerValueInCents: 78243,
      paymentMethod: "BILL" as const,
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "FAILED" as const,
      providerStatus: "CREATION_FAILED",
      failureCode: "RECURRING_PAYMENT_BILL_AMOUNT_MISMATCH",
      updatedAt: new Date("2026-10-01T12:00:00Z"),
    }

    const service = build([recurrence({ currentPayment: mismatched })], [])
    const result = await service.execute("church-1", "2026-10")

    expect(result[0]?.currentPayment).toMatchObject({
      status: "FAILED",
      amount: 742.83,
      providerValueInCents: 78243,
      failureCode: "RECURRING_PAYMENT_BILL_AMOUNT_MISMATCH",
    })
    expect(result[0]?.competenceStatus).toBe("FAILED")
  })
})
