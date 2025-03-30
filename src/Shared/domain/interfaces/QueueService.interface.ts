import { QueueName } from "@/Shared/domain"

export interface IQueueService {
  dispatch(queueName: QueueName, args: any): void
}
