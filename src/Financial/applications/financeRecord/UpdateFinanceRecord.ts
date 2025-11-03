import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { IQueue, IQueueService } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import {
  ConceptType,
  FinanceRecord,
  FinancialRecordStatus,
  UpdateStatusFinancialRecordQueue,
  TypeOperationMoney,
} from "@/Financial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { DispatchUpdateAvailabilityAccountBalance } from "@/Financial/applications/DispatchUpdateAvailabilityAccountBalance"
import { DispatchUpdateCostCenterMaster } from "@/Financial/applications/DispatchUpdateCostCenterMaster"

export class UpdateStatusFinancialRecord implements IQueue {
  private logger = Logger(UpdateStatusFinancialRecord.name)
  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService
  ) {}

  async handle(args: UpdateStatusFinancialRecordQueue): Promise<void> {
    this.logger.info(`UpdateFinancialRecord handle:`, args)

    const financialRecord = FinanceRecord.fromPrimitives(args.financialRecord)
    const previousStatus = financialRecord.getStatus()

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: financialRecord.getChurchId(),
      month: financialRecord.getDate().getMonth() + 1,
      year: financialRecord.getDate().getFullYear(),
    })

    financialRecord.setStatus(args.status)

    financialRecord.update()

    await this.financialRecordRepository.upsert(financialRecord)

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

    const availabilityAccountSnapshot =
      financialRecord.getAvailabilityAccount()

    if (availabilityAccountSnapshot) {
      const availabilityAccount =
        await this.availabilityAccountRepository.one({
          availabilityAccountId: availabilityAccountSnapshot.availabilityAccountId,
        })

      if (availabilityAccount) {
        new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
          availabilityAccount,
          amount: Math.abs(financialRecord.getAmount()),
          concept: financialRecord.getFinancialConcept().getName(),
          operationType:
            financialRecord.getFinancialConcept().getType() ===
            ConceptType.INCOME
              ? TypeOperationMoney.MONEY_IN
              : TypeOperationMoney.MONEY_OUT,
          createdAt: financialRecord.getDate(),
        })
      }
    }

    const costCenter = financialRecord.getCostCenter()

    if (costCenter) {
      new DispatchUpdateCostCenterMaster(this.queueService).execute({
        churchId: financialRecord.getChurchId(),
        amount: Math.abs(financialRecord.getAmount()),
        costCenterId: costCenter.costCenterId,
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
