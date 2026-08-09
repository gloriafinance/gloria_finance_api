import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import type {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import type { DatabaseTransactionContext } from "@/Shared/adapter"
import { Logger } from "@/Shared/adapter"
import {
  ConceptType,
  FinanceRecord,
  FinancialRecordStatus,
  TypeOperationMoney,
} from "@/Financial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { DispatchUpdateAvailabilityAccountBalance } from "@/Financial/applications/dispatchers/DispatchUpdateAvailabilityAccountBalance"
import { DispatchUpdateCostCenterMaster } from "@/Financial/applications/dispatchers/DispatchUpdateCostCenterMaster"
import type { IQueueService } from "@/package/queue/domain"
import type { UpdateStatusFinancialRecordQueue } from "@/Financial/applications"

type SideEffect = () => Promise<void> | void

export type UpdateFinancialRecordOptions = {
  validateFinancialMonth?: boolean
}

export class UpdateFinancialRecord {
  private logger = Logger(UpdateFinancialRecord.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(
    args: UpdateStatusFinancialRecordQueue,
    options?: UpdateFinancialRecordOptions,
    transaction?: DatabaseTransactionContext
  ): Promise<void> {
    this.logger.info(`UpdateFinancialRecord execute`, {
      ...args,
      churchId: args.financialRecord?.churchId,
      financialRecordId:
        args.financialRecord?.financialRecordId ??
        args.financialRecord?.financialRecordId,
    })

    const financialRecord = FinanceRecord.fromPrimitives(args.financialRecord)
    if (args.financialRecord.id) {
      financialRecord.assignId(String(args.financialRecord.id))
    }
    const previousStatus = financialRecord.getStatus()

    if (options?.validateFinancialMonth !== false) {
      const date = new Date(financialRecord.getDate())

      await new FinancialMonthValidator(this.financialYearRepository).validate({
        churchId: financialRecord.getChurchId(),
        month: date.getUTCMonth() + 1,
        year: date.getFullYear(),
      })
    }

    financialRecord.setStatus(args.status)
    financialRecord.update()

    await this.financialRecordRepository.upsert(financialRecord, transaction)

    this.logger.info(`UpdateFinancialRecord committed`, {
      churchId: financialRecord.getChurchId(),
      financialRecordId: financialRecord.getFinancialRecordId(),
      status: financialRecord.getStatus(),
    })

    await this.dispatchRealizationSideEffects(
      financialRecord,
      previousStatus,
      transaction
    )
  }

  private async dispatchRealizationSideEffects(
    financialRecord: FinanceRecord,
    previousStatus?: FinancialRecordStatus,
    transaction?: DatabaseTransactionContext
  ) {
    if (!this.isRealizedStatus(financialRecord.getStatus())) {
      return
    }

    if (this.isRealizedStatus(previousStatus)) {
      return
    }

    const availabilityAccountSnapshot = financialRecord.getAvailabilityAccount()

    const availabilityAccount = await this.availabilityAccountRepository.one(
      {
        availabilityAccountId:
          availabilityAccountSnapshot.availabilityAccountId,
      },
      transaction
    )

    if (availabilityAccount) {
      new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
        availabilityAccount,
        amount: Math.abs(financialRecord.getAmount()),
        concept: financialRecord.getFinancialConcept().getName(),
        operationType:
          financialRecord.getFinancialConcept().getType() === ConceptType.INCOME
            ? TypeOperationMoney.MONEY_IN
            : TypeOperationMoney.MONEY_OUT,
        createdAt: financialRecord.getDate(),
      })
    }

    const costCenter = financialRecord.getCostCenter()

    if (costCenter) {
      new DispatchUpdateCostCenterMaster(this.queueService).execute({
        churchId: financialRecord.getChurchId(),
        amount: Math.abs(financialRecord.getAmount()),
        costCenterId: costCenter.costCenterId,
        availabilityAccount: availabilityAccountSnapshot,
      })
    }
  }

  private isRealizedStatus(
    status?: FinancialRecordStatus
  ): status is FinancialRecordStatus {
    return (
      status === FinancialRecordStatus.CLEARED ||
      status === FinancialRecordStatus.RECONCILED
    )
  }
}
