import { QueueName } from "@/package/queue/domain"

export type QueueDispatchOptions = {
  delayMs?: number
  jobId?: string
}

export interface IQueueService {
  dispatch<T>(
    queueName: QueueName,
    args: T,
    options?: QueueDispatchOptions
  ): void
}
