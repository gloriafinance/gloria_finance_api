import type { IListQueue } from "@/package/queue/domain"
import { NotifyScheduleDay } from "@/Schedule/application/jobs/NotifyScheduleDay.ts"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { ScheduleItemMongoRepository } from "@/Schedule/infrastructure"
import { QueueService } from "@/package/queue/infrastructure"

export const ScheduleQueue = (): IListQueue[] => [
  {
    name: NotifyScheduleDay.name,
    useClass: NotifyScheduleDay,
    inject: [
      ChurchMongoRepository.getInstance(),
      ScheduleItemMongoRepository.getInstance(),
      QueueService.getInstance(),
    ],
    scheduler: {
      pattern: "* 9 * * *",
      tz: "America/Sao_Paulo",
    },
  },
]
