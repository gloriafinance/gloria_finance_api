import { ProcessInventoryFromFileJob } from "@/Patrimony"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import { QueueService } from "@/Shared/infrastructure"
import type { IListQueue } from "@/package/queue/domain"

export const PatrimonyQueue = (): IListQueue[] => [
  {
    name: ProcessInventoryFromFileJob.name,
    useClass: ProcessInventoryFromFileJob,
    inject: [AssetMongoRepository.getInstance(), QueueService.getInstance()],
  },
]
