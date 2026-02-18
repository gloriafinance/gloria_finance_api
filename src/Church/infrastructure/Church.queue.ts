import {
  GenerateDevotionalJob,
  RotateWhatsappAccessTokensJob,
  SendScheduledDevotionalJob,
} from "@/Church/applications"
import { ChurchMongoRepository } from "@/Church/infrastructure/persistence/ChurchMongoRepository"
import { MemberMongoRepository } from "@/Church/infrastructure/persistence/MemberMongoRepository"
import { DevotionalMongoRepository } from "@/Church/infrastructure/persistence/devotional/DevotionalMongoRepository"
import { DevotionalDeliveryLogMongoRepository } from "@/Church/infrastructure/persistence/devotional/DevotionalDeliveryLogMongoRepository"
import type { IListQueue } from "@/package/queue/domain"
import { QueueService } from "@/package/queue/infrastructure"

export const ChurchQueue = (): IListQueue[] => [
  {
    name: RotateWhatsappAccessTokensJob.name,
    useClass: RotateWhatsappAccessTokensJob,
    inject: [ChurchMongoRepository.getInstance()],
    scheduler: {
      pattern: process.env.WHATSAPP_TOKEN_ROTATION_CRON ?? "0 2 * * *",
      tz: process.env.WHATSAPP_TOKEN_ROTATION_TZ ?? "America/Sao_Paulo",
    },
  },
  {
    name: GenerateDevotionalJob.name,
    useClass: GenerateDevotionalJob,
    inject: [
      DevotionalMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance(),
      DevotionalDeliveryLogMongoRepository.getInstance(),
      MemberMongoRepository.getInstance(),
      QueueService.getInstance(),
    ],
  },
  {
    name: SendScheduledDevotionalJob.name,
    useClass: SendScheduledDevotionalJob,
    inject: [
      DevotionalMongoRepository.getInstance(),
      DevotionalDeliveryLogMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance(),
      MemberMongoRepository.getInstance(),
      QueueService.getInstance(),
    ],
  },
]
