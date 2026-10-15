import { describe, expect, it, jest } from "bun:test"
import { UpdateFinancialRecord } from "@/Financial/applications/financeRecord/UpdateFinancialRecord"
import { FinancialRecordStatus } from "@/Financial/domain/enums/FinancialRecordType.enum"

/**
 * A stored record in the given status, expressed as the queue payload the use
 * case receives. Only the fields `fromPrimitives` actually reads are supplied.
 */
function storedRecord(status: FinancialRecordStatus) {
  const now = new Date("2026-10-15T12:00:00.000Z")
  return {
    financialRecordId: "financial-record-1",
    financialConcept: {},
    churchId: "church-1",
    amount: 742.83,
    date: now,
    type: "OUTGO",
    availabilityAccount: { availabilityAccountId: "account-1" },
    description: "Aluguel",
    createdAt: now,
    updatedAt: now,
    source: "AUTO",
    createdBy: "user-1",
    status,
  }
}

function build() {
  const financialRecords = { upsert: jest.fn() }
  const months = { one: jest.fn().mockResolvedValue({ isClosed: () => false }) }
  const service = new UpdateFinancialRecord(
    months as never,
    financialRecords as never,
    { one: jest.fn() } as never,
    { dispatch: jest.fn() } as never
  )
  return { service, financialRecords }
}

describe("UpdateFinancialRecord", () => {
  it("refuses to void a reconciled record", async () => {
    // A reconciled record is backed by a real bank debit, so the reversal must
    // not reach persistence at all.
    const { service, financialRecords } = build()

    await expect(
      service.execute(
        {
          financialRecord: storedRecord(FinancialRecordStatus.RECONCILED),
          status: FinancialRecordStatus.VOID,
        } as never,
        { validateFinancialMonth: false }
      )
    ).rejects.toMatchObject({
      name: "RECONCILED_RECORD_CANNOT_BE_CANCELLED",
    })
    expect(financialRecords.upsert).not.toHaveBeenCalled()
  })

  it("still allows a non-reconciled record to be voided", async () => {
    const { service, financialRecords } = build()

    await service.execute(
      {
        financialRecord: storedRecord(FinancialRecordStatus.CLEARED),
        status: FinancialRecordStatus.VOID,
      } as never,
      { validateFinancialMonth: false }
    )

    expect(financialRecords.upsert).toHaveBeenCalledTimes(1)
  })
})
