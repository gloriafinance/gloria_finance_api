import { QueueName } from "@/Shared/domain"

export interface IQueueService {
  dispatch<T>(queueName: QueueName, args: T): void
}
