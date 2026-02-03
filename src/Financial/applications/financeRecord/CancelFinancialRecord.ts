import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import {
  AvailabilityAccount,
  ConceptType,
  type CreateFinanceRecord,
  FinanceRecord,
  FinancialMovementNotFound,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
  TypeOperationMoney,
} from "@/Financial/domain"
import { Logger } from "@/Shared/adapter"
import { DateBR, UnitOfWork } from "@/Shared/helpers"
import type {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import {
  GenericException,
  type IQueueService,
  QueueName,
} from "@/Shared/domain"
import {
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
  DispatchUpdateStatusFinancialRecord,
} from "@/Financial/applications"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"

/**
 * Este caso de uso se encarga de anular un registro financiero.
 * Si el registro es de tipo DESCARGO o INGRESO, se procede a revertirlo.
 */
export class CancelFinancialRecord {
  private logger = Logger(CancelFinancialRecord.name)
  private unitOfWork: UnitOfWork

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService
  ) {
    this.unitOfWork = new UnitOfWork()
  }

  async execute(params: {
    financialRecordId: string
    churchId: string
    createdBy: string
  }) {
    this.logger.info(`Execute financial recordId:`, params)

    const { financialRecordId, churchId, createdBy } = params

    const financialRecordSnapshot = await this.financialRecordRepository.one({
      financialRecordId,
      churchId,
    })

    if (!financialRecordSnapshot) {
      this.logger.error(`Movement not found`, params)
      throw new FinancialMovementNotFound()
    }

    const date = financialRecordSnapshot.getDate()

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: financialRecordSnapshot.getChurchId(),
      month: date.getUTCMonth() + 1,
      year: date.getFullYear(),
    })

    this.unitOfWork.registerRollbackActions(async () => {
      await this.financialRecordRepository.upsert(financialRecordSnapshot)
    })

    try {
      switch (financialRecordSnapshot.getType()) {
        case FinancialRecordType.OUTGO:
          await this.cancelOutgoRecord(financialRecordSnapshot, createdBy)
          break
        case FinancialRecordType.INCOME:
          await this.cancelIncomeRecord(financialRecordSnapshot, createdBy)
          break
        default:
          this.logger.error(
            `Unsupported FinancialRecordType for cancellation: ${financialRecordSnapshot.getType()}`,
            { financialRecordId, type: financialRecordSnapshot.getType() }
          )
          throw new GenericException(
            `Cannot cancel financial record of type ${financialRecordSnapshot.getType()}`
          )
      }

      await this.unitOfWork.commit()
      this.logger.info(`Financial record reversed successfully`)
    } catch (e) {
      if (e instanceof GenericException) {
        throw e
      }

      this.logger.error(`Error reversing financial record:`, e as any)
      await this.unitOfWork.rollback()
      throw e
    }
  }

  private async cancelOutgoRecord(
    financialRecord: FinanceRecord,
    createdBy: string
  ) {
    this.logger.info(`Canceling outgo record`)

    await this.cancelRecord({
      financialRecord,
      createdBy,
      availabilityOperation: TypeOperationMoney.MONEY_IN,
    })

    this.unitOfWork.execPostCommit(() => {
      new DispatchUpdateCostCenterMaster(this.queueService).execute({
        costCenterId: financialRecord.getCostCenterId()!,
        amount: financialRecord.getAmount(),
        churchId: financialRecord.getChurchId(),
        operation: "subtract",
        availabilityAccount: financialRecord.getAvailabilityAccount(),
      })
    })

    if (
      financialRecord.getFinancialConcept().getType() === ConceptType.PURCHASE
    ) {
      this.unitOfWork.execPostCommit(() => {
        this.queueService.dispatch(QueueName.DeletePurchasesJob, {
          purchaseIds: [financialRecord.getReference()!.entityId],
        })
      })
    }
  }

  private async cancelIncomeRecord(
    financialRecord: FinanceRecord,
    createdBy: string
  ) {
    await this.cancelRecord({
      financialRecord,
      createdBy,
      availabilityOperation: TypeOperationMoney.MONEY_OUT,
    })
  }

  private async cancelRecord(params: {
    financialRecord: FinanceRecord
    createdBy: string
    availabilityOperation: TypeOperationMoney
  }) {
    const { financialRecord, createdBy, availabilityOperation } = params

    const availabilityAccount = (await this.availabilityAccountRepository.one({
      availabilityAccountId: financialRecord.getAvailabilityAccountId(),
    }))!

    const cancellationDate = DateBR()
    cancellationDate.setUTCHours(0, 0, 0, 0)

    await this.financeRecordReversal({
      availabilityAccount,
      financeRecordReversal: {
        churchId: financialRecord.getChurchId(),
        amount: financialRecord.getAmount(),
        date: cancellationDate,
        availabilityAccount,
        description:
          "Reversão do movimento " + financialRecord.getFinancialRecordId(),
        type: FinancialRecordType.REVERSAL,
        status: FinancialRecordStatus.VOID,
        source: FinancialRecordSource.MANUAL,
        createdBy,
      },
      operation: availabilityOperation,
    })

    this.unitOfWork.execPostCommit(() => {
      new DispatchUpdateStatusFinancialRecord(this.queueService).execute({
        financialRecord: {
          ...financialRecord.toPrimitives(),
          id: financialRecord.getId(),
        },
        status: FinancialRecordStatus.VOID,
      })
    })
  }

  private async financeRecordReversal(params: {
    availabilityAccount: AvailabilityAccount
    financeRecordReversal: CreateFinanceRecord
    operation: TypeOperationMoney
  }) {
    this.logger.info(`Reversing financial record`, params)
    const { availabilityAccount, financeRecordReversal, operation } = params

    const financialRecordReversalAggregate = FinanceRecord.create(
      financeRecordReversal
    )
    await this.financialRecordRepository.upsert(
      financialRecordReversalAggregate
    )

    this.unitOfWork.registerRollbackActions(async () => {
      await this.financialRecordRepository.deleteByFinancialRecordId(
        financialRecordReversalAggregate.getFinancialRecordId()
      )
    })

    this.unitOfWork.execPostCommit(() => {
      new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
        availabilityAccount: availabilityAccount,
        amount: Math.abs(financeRecordReversal.amount),
        concept: financeRecordReversal.description!,
        operationType: operation,
        createdAt: financeRecordReversal.date,
      })
    })
  }
}
