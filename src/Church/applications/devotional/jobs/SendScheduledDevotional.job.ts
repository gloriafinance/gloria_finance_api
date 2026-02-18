import type {
  IChurchRepository,
  IDevotionalDeliveryLogRepository,
  IDevotionalRepository,
  IMemberRepository,
} from "@/Church/domain"
import { type IJob, type IQueueService } from "@/package/queue/domain"
import { DevotionalDeliveryService } from "@/Church/applications/devotional/services/DevotionalDeliveryService"

type SendScheduledDevotionalRequest = {
  churchId: string
  devotionalId: string
}

export class SendScheduledDevotionalJob implements IJob {
  private readonly deliveryService: DevotionalDeliveryService

  constructor(
    devotionalRepository: IDevotionalRepository,
    devotionalDeliveryLogRepository: IDevotionalDeliveryLogRepository,
    churchRepository: IChurchRepository,
    memberRepository: IMemberRepository,
    queueService: IQueueService
  ) {
    this.deliveryService = new DevotionalDeliveryService(
      devotionalRepository,
      devotionalDeliveryLogRepository,
      churchRepository,
      memberRepository,
      queueService
    )
  }

  async handle(jobData: SendScheduledDevotionalRequest): Promise<void> {
    await this.deliveryService.sendScheduled(
      jobData.churchId,
      jobData.devotionalId
    )
  }
}
