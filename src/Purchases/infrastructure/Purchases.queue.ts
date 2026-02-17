import { DeletePurchasesJob } from "@/Purchases/applications"
import { PurchaseMongoRepository } from "@/Purchases/infrastructure/persistence/PurchaseMongoRepository"
import { StorageProviderService } from "@/Shared/infrastructure"
import type { IListQueue } from "@/package/queue/domain"

export const PurchasesQueue = (): IListQueue[] => [
  {
    name: DeletePurchasesJob.name,
    useClass: DeletePurchasesJob,
    inject: [
      PurchaseMongoRepository.getInstance(),
      StorageProviderService.getInstance(),
    ],
    delay: 4,
  },
]
