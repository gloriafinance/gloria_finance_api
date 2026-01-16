import { Logger } from "@/Shared/adapter"
import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { IJob, IQueueService, IStorageService } from "@/Shared/domain"
import {
  AvailabilityAccount,
  ConceptType,
  CostCenter,
  FinanceRecord,
  FinancialConcept,
  FinancialRecordCreateQueue,
  FinancialRecordStatus,
  TypeOperationMoney,
} from "@/Financial/domain"
import { UnitOfWork } from "@/Shared/helpers"
import {
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
} from "@/Financial/applications"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"

export class CreateFinancialRecordJob implements IJob {
  private logger = Logger(CreateFinancialRecordJob.name)
  private unitOfWork: UnitOfWork

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly store: IStorageService,
    private readonly queueService: IQueueService
  ) {
    this.unitOfWork = new UnitOfWork()
  }

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

    args.availabilityAccount =
      typeof args.availabilityAccount === "object"
        ? AvailabilityAccount.fromPrimitives(args.availabilityAccount)
        : args.availabilityAccount

    let voucher = args.voucher
    if (args.file && !args.voucher) {
      voucher = await this.uploadFile(args.file)
    }

    try {
      this.postCommitAvailabilityAccountBalance(args)
      this.postCommitCostCenter(args)

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

      this.unitOfWork.registerRollbackActions(async () => {
        await this.financialRecordRepository.deleteByFinancialRecordId(
          financialRecord.getFinancialRecordId()
        )
      })

      await this.unitOfWork.commit()
      this.logger.info(`CreateFinancialRecord committed`, {
        jobName: CreateFinancialRecordJob.name,
        churchId: args.churchId,
        financialRecordId: financialRecord.getFinancialRecordId(),
      })
    } catch (e) {
      await this.unitOfWork.rollback()
      throw e
    }
  }

  private async uploadFile(file?: any): Promise<string | undefined> {
    if (!file) {
      return undefined
    }
    const voucher = await this.store.uploadFile(file)

    this.unitOfWork.registerRollbackActions(async () => {
      if (voucher) await this.store.deleteFile(voucher)
    })

    return voucher
  }

  private postCommitCostCenter(args: FinancialRecordCreateQueue) {
    if (!args.costCenter) {
      return
    }

    if (!this.isRealizedStatus(args.status)) {
      return
    }

    if (typeof args.costCenter === "object") {
      args.costCenter = CostCenter.fromPrimitives(args.costCenter)
    }

    this.unitOfWork.execPostCommit(async () => {
      new DispatchUpdateCostCenterMaster(this.queueService).execute({
        churchId: args.churchId,
        amount: args.amount,
        costCenterId: args.costCenter.getCostCenterId(),
      })
    })
  }

  private postCommitAvailabilityAccountBalance(
    args: FinancialRecordCreateQueue
  ) {
    if (!args.availabilityAccount) {
      return
    }

    if (!this.isRealizedStatus(args.status)) {
      return
    }

    this.unitOfWork.execPostCommit(async () => {
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
    })
  }

  private isRealizedStatus(status: FinancialRecordStatus): boolean {
    return (
      status === FinancialRecordStatus.CLEARED ||
      status === FinancialRecordStatus.RECONCILED
    )
  }
}
