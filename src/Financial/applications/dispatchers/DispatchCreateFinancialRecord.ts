import { type IQueueService, QueueName } from "@/Shared/domain"
import type { FinancialRecordCreateQueue } from "../../domain"
import { Logger } from "@/Shared/adapter"

export class DispatchCreateFinancialRecord {
  private logger = Logger("DispatchFinancialRecord")

  constructor(private readonly queueService: IQueueService) {}

  execute(financialRecord: FinancialRecordCreateQueue) {
    this.logger.info(`DispatchFinancialRecord`, financialRecord)

    this.queueService.dispatch(
      QueueName.CreateFinancialRecordJob,
      financialRecord
    )
  }
}
