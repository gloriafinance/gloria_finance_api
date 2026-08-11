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
import {
  DatabaseTransaction,
  type DatabaseTransactionContext,
} from "@/Shared/adapter/DatabaseTransaction.adapter"
import { DateBR } from "@/Shared/helpers"
import type {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { GenericException } from "@/Shared/domain"
import { type IQueueService, QueueName } from "@/package/queue/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { DispatchUpdateAvailabilityAccountBalance } from "@/Financial/applications/dispatchers/DispatchUpdateAvailabilityAccountBalance"
import { DispatchUpdateCostCenterMaster } from "@/Financial/applications/dispatchers/DispatchUpdateCostCenterMaster"
import { UpdateFinancialRecord } from "@/Financial/applications/financeRecord/UpdateFinancialRecord"

type CancellationSideEffects = {
  availabilityAccount: AvailabilityAccount
  amount: number
  concept: string
  operationType: TypeOperationMoney
  createdAt: Date
  purchaseId?: string
  costCenterId?: string
  costCenterAvailabilityAccount?: ReturnType<
    FinanceRecord["getAvailabilityAccount"]
  >
}

/**
 * Este caso de uso se encarga de anular un registro financiero.
 * Si el registro es de tipo DESCARGO o INGRESO, se procede a revertirlo.
 */
export class CancelFinancialRecord {
  private logger = Logger(CancelFinancialRecord.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(params: {
    financialRecordId: string
    churchId: string
    createdBy: string
  }) {
    this.logger.info(`Execute financial recordId:`, params)

    const { financialRecordId, churchId, createdBy } = params

    try {
      const cancellationSideEffects = await DatabaseTransaction.run(
        async (transaction) => {
          const financialRecord = await this.financialRecordRepository.one(
            {
              financialRecordId,
              churchId,
            },
            transaction
          )

          if (!financialRecord) {
            this.logger.error(`Movement not found`, params)
            throw new FinancialMovementNotFound()
          }

          const date = financialRecord.getDate()

          await new FinancialMonthValidator(
            this.financialYearRepository
          ).validate({
            churchId: financialRecord.getChurchId(),
            month: date.getUTCMonth() + 1,
            year: date.getFullYear(),
          })

          switch (financialRecord.getType()) {
            case FinancialRecordType.OUTGO:
              return await this.cancelOutgoRecord(
                financialRecord,
                createdBy,
                transaction
              )
            case FinancialRecordType.INCOME:
              return await this.cancelRecord({
                financialRecord,
                createdBy,
                transaction,
              })
            default:
              this.logger.error(
                `Unsupported FinancialRecordType for cancellation: ${financialRecord.getType()}`,
                { financialRecordId, type: financialRecord.getType() }
              )
              throw new GenericException(
                `Cannot cancel financial record of type ${financialRecord.getType()}`
              )
          }
        }
      )

      this.dispatchCancellationSideEffects(cancellationSideEffects)
      this.logger.info(`Financial record reversed successfully`)
    } catch (e) {
      this.logger.error(`Error reversing financial record:`, e as any)
      if (e instanceof GenericException) {
        throw e
      }

      throw e
    }
  }

  private dispatchCancellationSideEffects(
    sideEffects: CancellationSideEffects
  ) {
    new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
      availabilityAccount: sideEffects.availabilityAccount,
      amount: sideEffects.amount,
      concept: sideEffects.concept,
      operationType: sideEffects.operationType,
      createdAt: sideEffects.createdAt,
    })

    if (sideEffects.costCenterId && sideEffects.costCenterAvailabilityAccount) {
      new DispatchUpdateCostCenterMaster(this.queueService).execute({
        churchId: sideEffects.availabilityAccount.getChurchId(),
        amount: sideEffects.amount,
        costCenterId: sideEffects.costCenterId,
        operation: "subtract",
        availabilityAccount: sideEffects.costCenterAvailabilityAccount,
      })
    }

    if (sideEffects.purchaseId) {
      this.queueService.dispatch(QueueName.PurchasesEvent, {
        event: "delete",
        source: "financialRegistrationCancelled",
        data: { purchaseIds: [sideEffects.purchaseId] },
      })
    }
  }

  private async cancelOutgoRecord(
    financialRecord: FinanceRecord,
    createdBy: string,
    transaction: DatabaseTransactionContext
  ): Promise<CancellationSideEffects> {
    this.logger.info(`Canceling outgo record`)

    const sideEffects = await this.cancelRecord({
      financialRecord,
      createdBy,
      transaction,
    })

    const costCenterId = financialRecord.getCostCenterId()

    if (costCenterId) {
      sideEffects.costCenterId = costCenterId
      sideEffects.costCenterAvailabilityAccount =
        financialRecord.getAvailabilityAccount()
    }

    if (
      financialRecord.getFinancialConcept().getType() === ConceptType.PURCHASE
    ) {
      sideEffects.purchaseId = financialRecord.getReference()!.entityId
    }

    return sideEffects
  }

  private async cancelRecord(params: {
    financialRecord: FinanceRecord
    createdBy: string
    transaction: DatabaseTransactionContext
  }): Promise<CancellationSideEffects> {
    const { financialRecord, createdBy, transaction } = params

    const availabilityAccount = (await this.availabilityAccountRepository.one(
      {
        availabilityAccountId: financialRecord.getAvailabilityAccountId(),
      },
      transaction
    ))!

    const cancellationDate = DateBR()
    cancellationDate.setUTCHours(0, 0, 0, 0)

    await this.financeRecordReversal({
      availabilityAccount,
      financeRecordReversal: {
        financialConcept: financialRecord.getFinancialConcept(),
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
      transaction,
    })

    await new UpdateFinancialRecord(
      this.financialYearRepository,
      this.financialRecordRepository,
      this.availabilityAccountRepository,
      this.queueService
    ).execute(
      {
        financialRecord: {
          ...financialRecord.toPrimitives(),
          id: financialRecord.getId(),
        },
        status: FinancialRecordStatus.VOID,
      },
      {
        validateFinancialMonth: false,
      },
      transaction
    )

    return {
      availabilityAccount,
      amount: Math.abs(financialRecord.getAmount()),
      concept: `Reversão do movimento ${financialRecord.getFinancialRecordId()}`,
      operationType:
        financialRecord.getFinancialConcept().getType() === ConceptType.INCOME
          ? TypeOperationMoney.MONEY_OUT
          : TypeOperationMoney.MONEY_IN,
      createdAt: cancellationDate,
    }
  }

  private async financeRecordReversal(params: {
    availabilityAccount: AvailabilityAccount
    financeRecordReversal: CreateFinanceRecord
    transaction: DatabaseTransactionContext
  }) {
    this.logger.info(`Reversing financial record`, params)
    const { financeRecordReversal, transaction } = params

    const financialRecordReversalAggregate = FinanceRecord.create(
      financeRecordReversal
    )
    await this.financialRecordRepository.upsert(
      financialRecordReversalAggregate,
      transaction
    )
  }
}
