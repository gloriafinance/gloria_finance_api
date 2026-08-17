import {
  FinanceRecord,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"
import { UpdateFinancialRecord } from "@/Financial/applications/financeRecord/UpdateFinancialRecord"
import { ConceptType } from "@/FinanceConfig/domain"

describe("FinanceRecord", () => {
  it("allows a DTO consumer to restore the aggregate identity explicitly", () => {
    const record = FinanceRecord.fromPrimitives({
      id: "6a789edd48ff2ab6f8fc3e9a",
      financialRecordId: "urn:financialRecord:financial-record-1",
      churchId: "church-1",
      amount: 100,
      date: new Date("2026-08-09"),
      type: FinancialRecordType.INCOME,
      status: FinancialRecordStatus.CLEARED,
      source: FinancialRecordSource.MANUAL,
      createdBy: "user-1",
      createdAt: new Date("2026-08-09"),
      updatedAt: new Date("2026-08-09"),
      availabilityAccount: {
        availabilityAccountId: "availability-1",
        accountName: "Main account",
        accountType: "BANK",
        symbol: "R$",
      },
      financialConcept: {
        id: "concept-db-id",
        financialConceptId: "concept-1",
        churchId: "church-1",
        name: "Concept",
        description: "Description",
        active: true,
        type: ConceptType.INCOME,
        statementCategory: "REVENUE",
        createdAt: new Date("2026-08-09"),
      },
    })

    expect(record.getId()).toBeUndefined()

    record.assignId("6a789edd48ff2ab6f8fc3e9a")

    expect(record.getId()).toBe("6a789edd48ff2ab6f8fc3e9a")
  })

  it("preserves the DTO identity before updating the record", async () => {
    const record = FinanceRecord.fromPrimitives({
      financialRecordId: "urn:financialRecord:financial-record-1",
      churchId: "church-1",
      amount: 100,
      date: new Date("2026-08-09"),
      type: FinancialRecordType.INCOME,
      status: FinancialRecordStatus.CLEARED,
      source: FinancialRecordSource.MANUAL,
      createdBy: "user-1",
      createdAt: new Date("2026-08-09"),
      updatedAt: new Date("2026-08-09"),
      availabilityAccount: {
        availabilityAccountId: "availability-1",
        accountName: "Main account",
        accountType: "BANK",
        symbol: "R$",
      },
      financialConcept: {
        financialConceptId: "concept-1",
        churchId: "church-1",
        name: "Concept",
        description: "Description",
        active: true,
        type: ConceptType.INCOME,
        statementCategory: "REVENUE",
        createdAt: new Date("2026-08-09"),
      },
    })
    const financialRecordRepository = { upsert: jest.fn() }
    const useCase = new UpdateFinancialRecord(
      {} as any,
      financialRecordRepository as any,
      {} as any,
      { dispatch: jest.fn() } as any
    )

    await useCase.execute(
      {
        financialRecord: {
          ...record.toPrimitives(),
          id: "6a789edd48ff2ab6f8fc3e9a",
        },
        status: FinancialRecordStatus.VOID,
      },
      { validateFinancialMonth: false }
    )

    expect(financialRecordRepository.upsert).toHaveBeenCalledTimes(1)
    expect(financialRecordRepository.upsert.mock.calls[0][0].getId()).toBe(
      "6a789edd48ff2ab6f8fc3e9a"
    )
  })
})
