import { RotateWhatsappAccessTokensJob } from "@/Church/applications"
import { ChurchMongoRepository } from "@/Church/infrastructure/persistence/ChurchMongoRepository"
import type { IListQueue } from "@/package/queue/domain"

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
]
