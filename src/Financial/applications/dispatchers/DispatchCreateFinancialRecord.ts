import type { FinancialRecordCreateQueue } from "../../domain"
import { Logger } from "@/Shared/adapter"
import { type IQueueService, QueueName } from "@/package/queue/domain"

export class DispatchCreateFinancialRecord {
  private logger = Logger("DispatchFinancialRecord")

  constructor(private readonly queueService: IQueueService) {}

  async execute(financialRecord: FinancialRecordCreateQueue): Promise<void> {
    this.logger.info(`DispatchFinancialRecord`, financialRecord)

    this.queueService.dispatch(
      QueueName.CreateFinancialRecordJob,
      financialRecord
    )
  }
}
