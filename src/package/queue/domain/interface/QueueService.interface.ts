import { QueueName } from "@/package/queue/domain"

export interface IQueueService {
  dispatch<T>(queueName: QueueName, args: T): void
}
