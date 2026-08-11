import { CancelFinancialRecord } from "@/Financial/applications/financeRecord/CancelFinancialRecord"
import { UpdateFinancialRecord } from "@/Financial/applications/financeRecord/UpdateFinancialRecord"
import {
  FinancialRecordType,
  FinancialRecordSource,
  FinancialRecordStatus,
  TypeOperationMoney,
  type FinanceRecord,
} from "@/Financial/domain"
import type {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { type IQueueService, QueueName } from "@/package/queue/domain"
import { MongoTransaction } from "@abejarano/ts-mongodb-criteria"

describe("CancelFinancialRecord", () => {
  const financialYearRepository = {
    one: jest.fn(),
  } as unknown as jest.Mocked<IFinancialYearRepository>
  const financialRecordRepository = {
    one: jest.fn(),
  } as unknown as jest.Mocked<IFinancialRecordRepository>
  const availabilityAccountRepository =
    {} as unknown as jest.Mocked<IAvailabilityAccountRepository>
  const queueService = {
    dispatch: jest.fn(),
  } as jest.Mocked<IQueueService>
  const availabilityAccount = {
    getChurchId: () => "church-1",
    getId: () => "availability-db-id",
    getType: () => "CASH",
    toPrimitives: () => ({}),
  } as any

  let useCase: CancelFinancialRecord

  beforeEach(() => {
    jest.clearAllMocks()
    financialYearRepository.one.mockResolvedValue({
      isClosed: () => false,
    } as any)
    financialRecordRepository.one.mockResolvedValue({
      getDate: () => new Date(),
      getChurchId: () => "church-1",
      getType: () => FinancialRecordType.OUTGO,
    } as FinanceRecord)
    useCase = new CancelFinancialRecord(
      financialYearRepository,
      financialRecordRepository,
      availabilityAccountRepository,
      queueService
    )
    jest.spyOn(useCase as any, "cancelOutgoRecord").mockResolvedValue({
      availabilityAccount,
      amount: 100,
      concept: "Reversão do movimento financial-record-1",
      operationType: TypeOperationMoney.MONEY_IN,
      createdAt: new Date("2026-08-10"),
      purchaseId: "purchase-1",
      costCenterId: "cost-center-1",
      costCenterAvailabilityAccount: {
        availabilityAccountId: "availability-1",
        accountName: "Cash",
        accountType: "CASH",
        symbol: "R$",
      },
    })
  })

  it("does not delete the purchase when the cancellation transaction cannot commit", async () => {
    const commitError = new Error("transaction commit failed")
    const transactionRun = jest
      .spyOn(MongoTransaction, "run")
      .mockImplementation(async (callback) => {
        await callback({} as MongoTransaction)
        throw commitError
      })

    await expect(
      useCase.execute({
        financialRecordId: "financial-record-1",
        churchId: "church-1",
        createdBy: "user-1",
      })
    ).rejects.toThrow(commitError)

    expect(queueService.dispatch).not.toHaveBeenCalled()
    transactionRun.mockRestore()
  })

  it("restores balances and deletes the purchase after the cancellation transaction commits", async () => {
    const transactionRun = jest
      .spyOn(MongoTransaction, "run")
      .mockImplementation(async (callback) => callback({} as MongoTransaction))

    await useCase.execute({
      financialRecordId: "financial-record-1",
      churchId: "church-1",
      createdBy: "user-1",
    })

    expect(queueService.dispatch).toHaveBeenCalledWith(
      QueueName.UpdateAvailabilityAccountBalanceJob,
      expect.objectContaining({
        amount: 100,
        operationType: TypeOperationMoney.MONEY_IN,
      })
    )
    expect(queueService.dispatch).toHaveBeenCalledWith(
      QueueName.UpdateCostCenterMasterJob,
      expect.objectContaining({
        amount: 100,
        costCenterId: "cost-center-1",
        operation: "subtract",
      })
    )
    expect(queueService.dispatch).toHaveBeenCalledWith(
      QueueName.PurchasesEvent,
      {
        event: "delete",
        source: "financialRegistrationCancelled",
        data: { purchaseIds: ["purchase-1"] },
      }
    )
    transactionRun.mockRestore()
  })

  it("preserves the original financial concept in the reversal", async () => {
    const financialConcept = {
      getFinancialConceptId: () => "concept-1",
      getType: () => "INCOME",
    } as any
    const financeRecordReversal = jest
      .spyOn(useCase as any, "financeRecordReversal")
      .mockResolvedValue(undefined)
    const updateFinancialRecord = jest
      .spyOn(UpdateFinancialRecord.prototype, "execute")
      .mockResolvedValue(undefined)

    availabilityAccountRepository.one = jest
      .fn()
      .mockResolvedValue(availabilityAccount)

    await (useCase as any).cancelRecord({
      financialRecord: {
        getAvailabilityAccountId: () => "availability-1",
        getFinancialConcept: () => financialConcept,
        getChurchId: () => "church-1",
        getAmount: () => 100,
        getFinancialRecordId: () => "financial-record-1",
        getId: () => "financial-db-id",
        toPrimitives: () => ({
          financialConcept: { financialConceptId: "concept-1" },
        }),
      } as any,
      createdBy: "user-1",
      transaction: {} as MongoTransaction,
    })

    expect(financeRecordReversal).toHaveBeenCalledWith(
      expect.objectContaining({
        financeRecordReversal: expect.objectContaining({
          financialConcept,
          status: FinancialRecordStatus.VOID,
          source: FinancialRecordSource.MANUAL,
        }),
      })
    )

    updateFinancialRecord.mockRestore()
  })
})
