import { DeletePurchasesJob } from "@/Purchases/applications"
import { PurchaseMongoRepository } from "@/Purchases/infrastructure/persistence/PurchaseMongoRepository"
import { StorageGCP } from "@/Shared/infrastructure"
import type { IListQueue } from "@/package/queue/domain"

export const PurchasesQueue = (): IListQueue[] => [
  {
    name: DeletePurchasesJob.name,
    useClass: DeletePurchasesJob,
    inject: [
      PurchaseMongoRepository.getInstance(),
      StorageGCP.getInstance(process.env.BUCKET_FILES!),
    ],
    delay: 4,
  },
]
