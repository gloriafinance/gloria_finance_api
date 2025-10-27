import { IDefinitionQueue } from "@/Shared/domain"
import { ImportInventoryFromFile } from "@/Patrimony"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import { QueueService } from "@/Shared/infrastructure"

export const PatrimonyQueue = (): IDefinitionQueue[] => [
  {
    useClass: ImportInventoryFromFile,
    inject: [AssetMongoRepository.getInstance(), QueueService.getInstance()],
  },
]
