import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { IQueue, IQueueService, IStorageService } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import {
  ConceptType,
  FinanceRecord,
  FinancialRecordUpdateQueue,
  TypeOperationMoney,
} from "@/Financial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { DateBR, UnitOfWork } from "@/Shared/helpers"
import {
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
} from "@/Financial/applications"

export class UpdateFinancialRecord implements IQueue {
  private logger = Logger(UpdateFinancialRecord.name)
  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly store: IStorageService,
    private readonly queueService: IQueueService
  ) {}

  async handle(args: FinancialRecordUpdateQueue): Promise<void> {
    this.logger.info(`UpdateFinancialRecord handle:`, args)

    const financialRecord = FinanceRecord.fromPrimitives(args.financialRecord)

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: financialRecord.getChurchId(),
    })

    const unitOfWork = new UnitOfWork()

    const financialRecordSnapshot = FinanceRecord.fromPrimitives({
      ...financialRecord.toPrimitives(),
      id: financialRecord.getId(),
    })

    unitOfWork.registerRollbackActions(async () => {
      await this.financialRecordRepository.upsert(financialRecordSnapshot)
    })

    if (args.availabilityAccount) {
      unitOfWork.execPostCommit(async () => {
        const financialConcept = financialRecord.getFinancialConcept()
        new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute(
          {
            availabilityAccount: args.availabilityAccount,
            amount: financialRecord.getAmount(),
            concept: financialConcept.getName(),
            operationType:
              financialConcept.getType() === ConceptType.INCOME
                ? TypeOperationMoney.MONEY_IN
                : TypeOperationMoney.MONEY_OUT,
            createdAt: DateBR(),
          }
        )
      })
    }

    if (args.costCenter) {
      unitOfWork.execPostCommit(async () => {
        new DispatchUpdateCostCenterMaster(this.queueService).execute({
          churchId: financialRecord.getChurchId(),
          amount: financialRecord.getAmount(),
          costCenterId: args.costCenter.getCostCenterId(),
        })
      })
    }

    try {
      let voucher: string = undefined
      if (args.file) {
        voucher = await this.store.uploadFile(args.file)
        financialRecord.setVoucher(voucher)

        unitOfWork.registerRollbackActions(async () => {
          if (voucher) await this.store.deleteFile(voucher)
        })
      }

      if (args.status) {
        financialRecord.setStatus(args.status)
      }

      financialRecord.update()

      await this.financialRecordRepository.upsert(financialRecord)

      await unitOfWork.commit()
    } catch (e) {
      this.logger.error(`UpdateFinancialRecord error:`, e)
      await unitOfWork.rollback()
      throw e
    }
  }
}
