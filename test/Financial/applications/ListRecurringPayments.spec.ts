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
})
