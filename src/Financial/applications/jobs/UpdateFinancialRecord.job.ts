import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import type {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { Logger } from "@/Shared/adapter"
import { type UpdateStatusFinancialRecordQueue } from "@/Financial/domain"
import { UpdateFinancialRecord } from "@/Financial/applications/financeRecord/UpdateFinancialRecord"
import type { IJob, IQueueService } from "@/package/queue/domain"

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

    await new UpdateFinancialRecord(
      this.financialYearRepository,
      this.financialRecordRepository,
      this.availabilityAccountRepository,
      this.queueService
    ).execute(args)
  }
}
