import type { IListQueue } from "@/package/queue/domain"
import { NotifyScheduleDay } from "@/Schedule/application/jobs/NotifyScheduleDay.ts"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import {
  ScheduleItemMongoRepository,
  ScheduleReminderDayjsService,
} from "@/Schedule/infrastructure"
import { QueueService } from "@/package/queue/infrastructure"
import { CacheProviderService } from "@/Shared/infrastructure/services/CacheProvider.service"

export const ScheduleQueue = (): IListQueue[] => [
  {
    name: NotifyScheduleDay.name,
    useClass: NotifyScheduleDay,
    inject: [
      ChurchMongoRepository.getInstance(),
      ScheduleItemMongoRepository.getInstance(),
      QueueService.getInstance(),
      ScheduleReminderDayjsService.getInstance(),
      CacheProviderService.getInstance(),
    ],
    scheduler: {
      pattern: "0 12 * * *",
      tz: "UTC",
    },
  },
]
