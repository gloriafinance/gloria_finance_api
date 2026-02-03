import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import type {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import type { IJob, IQueueService } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import {
  ConceptType,
  FinanceRecord,
  FinancialRecordStatus,
  TypeOperationMoney,
  type UpdateStatusFinancialRecordQueue,
} from "@/Financial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { DispatchUpdateAvailabilityAccountBalance } from "@/Financial/applications/dispatchers/DispatchUpdateAvailabilityAccountBalance"
import { DispatchUpdateCostCenterMaster } from "@/Financial/applications/dispatchers/DispatchUpdateCostCenterMaster"

export class UpdateFinancialRecordJob implements IJob {
  private logger = Logger(UpdateFinancialRecordJob.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService
  ) {}

  async handle(args: UpdateStatusFinancialRecordQueue): Promise<void> {
    this.logger.info(`UpdateFinancialRecord handle`, {
      ...args,
      jobName: UpdateFinancialRecordJob.name,
      churchId: args.financialRecord?.churchId,
      financialRecordId:
        args.financialRecord?.financialRecordId ??
        args.financialRecord?.financialRecordId,
    })

    const financialRecord = FinanceRecord.fromPrimitives(args.financialRecord)
    const previousStatus = financialRecord.getStatus()

    const date = new Date(financialRecord.getDate())

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: financialRecord.getChurchId(),
      month: date.getUTCMonth() + 1,
      year: date.getFullYear(),
    })

    financialRecord.setStatus(args.status)

    financialRecord.update()

    await this.financialRecordRepository.upsert(financialRecord)

    this.logger.info(`UpdateFinancialRecord committed`, {
      jobName: UpdateFinancialRecordJob.name,
      churchId: financialRecord.getChurchId(),
      financialRecordId: financialRecord.getFinancialRecordId(),
      status: financialRecord.getStatus(),
    })

    await this.dispatchRealizationSideEffects(financialRecord, previousStatus)
  }

  private async dispatchRealizationSideEffects(
    financialRecord: FinanceRecord,
    previousStatus?: FinancialRecordStatus
  ) {
    if (!this.isRealizedStatus(financialRecord.getStatus())) {
      return
    }

    if (this.isRealizedStatus(previousStatus)) {
      return
    }

    const availabilityAccountSnapshot = financialRecord.getAvailabilityAccount()

    const availabilityAccount = await this.availabilityAccountRepository.one({
      availabilityAccountId: availabilityAccountSnapshot.availabilityAccountId,
    })

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
