import {
  DevotionalPlanMode,
  type IChurchRepository,
  type IDevotionalDeliveryLogRepository,
  type IDevotionalRepository,
  type IMemberRepository,
} from "@/Church/domain"
import { type IJob, type IQueueService } from "@/package/queue/domain"
import { DevotionalDeliveryService } from "@/Church/applications/devotional/services/DevotionalDeliveryService"
import { DevotionalGenerationService } from "@/Church/applications/devotional/services/DevotionalGenerationService"
import { Logger } from "@/Shared/adapter"

type GenerateDevotionalRequest = {
  churchId: string
  devotionalId: string
}

export class GenerateDevotionalJob implements IJob {
  private readonly logger = Logger(GenerateDevotionalJob.name)
  private readonly generationService: DevotionalGenerationService
  private readonly deliveryService: DevotionalDeliveryService

  constructor(
    devotionalRepository: IDevotionalRepository,
    churchRepository: IChurchRepository,
    devotionalDeliveryLogRepository: IDevotionalDeliveryLogRepository,
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

    this.generationService = new DevotionalGenerationService(
      devotionalRepository,
      churchRepository
    )
  }

  async handle(jobData: GenerateDevotionalRequest): Promise<void> {
    this.logger.info(`Staring generate devotional`, jobData)
    const { devotional, church } = await this.generationService.generate(
      jobData.churchId,
      jobData.devotionalId
    )

    if (!devotional && !church) {
      this.logger.error(`Failed to generate devotional`, jobData)
      return
    }

    if (devotional!.getPlanSnapshot().mode === DevotionalPlanMode.AUTOMATIC) {
      this.deliveryService.scheduleDelivery(devotional!)
    } else {
      await this.deliveryService.notifyPastorsForReview(church!, devotional!)
    }

    this.logger.info(`Finished generate devotional`)
  }
}
