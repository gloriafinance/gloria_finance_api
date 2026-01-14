import { IDefinitionQueue } from "@/Shared/domain"
import { DeletePurchasesJob } from "@/Purchases/applications"
import { PurchaseMongoRepository } from "@/Purchases/infrastructure/persistence/PurchaseMongoRepository"
import { StorageGCP } from "@/Shared/infrastructure"
export const PurchasesQueue = (): IDefinitionQueue[] => [
  {
    useClass: DeletePurchasesJob,
    inject: [
      PurchaseMongoRepository.getInstance(),
      StorageGCP.getInstance(process.env.BUCKET_FILES),
    ],
    delay: 4,
  },
]
