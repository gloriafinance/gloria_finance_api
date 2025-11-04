import { IQueueService, QueueName } from "@/Shared/domain"
import { UpdateStatusFinancialRecordQueue } from "../domain"
import { Logger } from "@/Shared/adapter"

export class DispatchUpdateStatusFinancialRecord {
  private logger = Logger(DispatchUpdateStatusFinancialRecord.name)

  constructor(private readonly queueService: IQueueService) {}

  execute(financialRecord: UpdateStatusFinancialRecordQueue) {
    this.logger.info(`DispatchUpdateStatusFinancialRecord`, financialRecord)

    this.queueService.dispatch(QueueName.UpdateFinancialRecord, financialRecord)
  }
}
