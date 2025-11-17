import { IDefinitionQueue } from "@/Shared/domain"
import { ProcessInventoryFromFileJob } from "@/Patrimony"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import { QueueService } from "@/Shared/infrastructure"

export const PatrimonyQueue = (): IDefinitionQueue[] => [
  {
    useClass: ProcessInventoryFromFileJob,
    inject: [AssetMongoRepository.getInstance(), QueueService.getInstance()],
  },
]
