import { Logger } from "@/Shared/adapter"
import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import type { IStorageService } from "@/Shared/domain"
import {
  AvailabilityAccount,
  ConceptType,
  CostCenter,
  FinanceRecord,
  FinancialConcept,
  type FinancialRecordCreateQueue,
  FinancialRecordStatus,
  TypeOperationMoney,
} from "@/Financial/domain"
import {
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
} from "@/Financial/applications"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import type { IJob, IQueueService } from "@/package/queue/domain"

export class CreateFinancialRecordJob implements IJob {
  private logger = Logger(CreateFinancialRecordJob.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly store: IStorageService,
    private readonly queueService: IQueueService
  ) {}

  async handle(args: FinancialRecordCreateQueue): Promise<void> {
    this.logger.info(`CreateFinancialRecord`, {
      ...args,
      jobName: CreateFinancialRecordJob.name,
    })

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: args.churchId,
      month: new Date(args.date).getUTCMonth() + 1,
      year: new Date(args.date).getFullYear(),
    })

    if (typeof args.availabilityAccount === "object") {
      const aggregateId = args.availabilityAccount.aggregateId

      const availabilityAccount = AvailabilityAccount.fromPrimitives(
        args.availabilityAccount
      )
      availabilityAccount.assignId(aggregateId)

      args.availabilityAccount = availabilityAccount
    }

    const voucher = args.voucher

    try {
      const financialRecord = FinanceRecord.create({
        financialConcept: args.financialConcept,
        churchId: args.churchId,
        amount: args.amount,
        date: new Date(args.date),
        availabilityAccount: args.availabilityAccount,
        description: args.description,
        voucher,
        costCenter: args.costCenter,
        type: args.financialRecordType,
        status: args.status,
        source: args.source,
        createdBy: args.createdBy,
        reference: args.reference,
      })
      await this.financialRecordRepository.upsert(financialRecord)

      this.logger.info(`CreateFinancialRecord committed`, {
        jobName: CreateFinancialRecordJob.name,
        churchId: args.churchId,
        financialRecordId: financialRecord.getFinancialRecordId(),
      })

      this.dispatchUpdateAvailabilityAccountBalance(args)
      this.dispatchUpdateCostCenter(args)
    } catch (e: any) {
      this.logger.error(`Error in create financial record process ${e.message}`)

      if (voucher) await this.store.deleteFile(voucher)

      throw e
    }
  }

  private dispatchUpdateCostCenter(args: FinancialRecordCreateQueue) {
    if (!args.costCenter) {
      return
    }

    if (!this.isRealizedStatus(args.status)) {
      return
    }

    if (typeof args.costCenter === "object") {
      args.costCenter = CostCenter.fromPrimitives(args.costCenter)
    }

    new DispatchUpdateCostCenterMaster(this.queueService).execute({
      churchId: args.churchId,
      amount: args.amount,
      costCenterId: args.costCenter!.getCostCenterId(),
      availabilityAccount: {
        availabilityAccountId:
          args.availabilityAccount.getAvailabilityAccountId(),
        accountName: args.availabilityAccount.getAccountName(),
        accountType: args.availabilityAccount.getType(),
        symbol: args.availabilityAccount.getSymbol(),
      },
    })
  }

  private dispatchUpdateAvailabilityAccountBalance(
    args: FinancialRecordCreateQueue
  ) {
    if (!args.availabilityAccount) {
      return
    }

    if (!this.isRealizedStatus(args.status)) {
      return
    }

    const financialConcept =
      typeof args.financialConcept === "object"
        ? FinancialConcept.fromPrimitives(args.financialConcept)
        : args.financialConcept

    new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
      availabilityAccount: args.availabilityAccount,
      amount: args.amount,
      concept: financialConcept.getName(),
      operationType:
        financialConcept.getType() === ConceptType.INCOME
          ? TypeOperationMoney.MONEY_IN
          : TypeOperationMoney.MONEY_OUT,
      createdAt: args.date,
    })
  }

  private isRealizedStatus(status: FinancialRecordStatus): boolean {
    return (
      status === FinancialRecordStatus.CLEARED ||
      status === FinancialRecordStatus.RECONCILED
    )
  }
}
