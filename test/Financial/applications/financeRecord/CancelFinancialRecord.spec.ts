import { describe, expect, it, jest } from "bun:test"
import { CancelFinancialRecord } from "@/Financial/applications/financeRecord/CancelFinancialRecord"
import { FinancialRecordStatus } from "@/Financial/domain/enums/FinancialRecordType.enum"

function build(status: FinancialRecordStatus) {
  const financialRecords = {
    one: jest.fn().mockResolvedValue({ getStatus: () => status }),
  }
  const service = new CancelFinancialRecord(
    { one: jest.fn() } as never,
    financialRecords as never,
    { one: jest.fn() } as never,
    { dispatch: jest.fn() } as never
  )
  return { service, financialRecords }
}

describe("CancelFinancialRecord", () => {
  it("refuses to cancel a reconciled record", async () => {
    // A reconciled record is backed by a real bank debit. The refusal must happen
    // before any transaction is opened, so the reversal never starts.
    const { service } = build(FinancialRecordStatus.RECONCILED)

    await expect(
      service.execute({
        financialRecordId: "financial-record-1",
        churchId: "church-1",
        createdBy: "user-1",
      })
    ).rejects.toMatchObject({
      name: "RECONCILED_RECORD_CANNOT_BE_CANCELLED",
    })
  })

  it("does not open a transaction just to reject a reconciled record", async () => {
    const { service, financialRecords } = build(
      FinancialRecordStatus.RECONCILED
    )

    await expect(
      service.execute({
        financialRecordId: "financial-record-1",
        churchId: "church-1",
        createdBy: "user-1",
      })
    ).rejects.toBeDefined()

    // Exactly the pre-check read, nothing from inside the transaction.
    expect(financialRecords.one).toHaveBeenCalledTimes(1)
  })
})
