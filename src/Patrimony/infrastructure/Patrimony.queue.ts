import { IDefinitionQueue } from "@/Shared/domain"
import { ProcessInventoryFromFile } from "@/Patrimony"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import { QueueService } from "@/Shared/infrastructure"

export const PatrimonyQueue = (): IDefinitionQueue[] => [
  {
    useClass: ProcessInventoryFromFile,
    inject: [AssetMongoRepository.getInstance(), QueueService.getInstance()],
  },
]
