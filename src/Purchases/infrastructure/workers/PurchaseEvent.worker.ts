import type { IJob } from "@/package/queue/domain"
import { DeletePurchases } from "@/Purchases/applications"
import type { PurchaseEvent } from "@/Purchases/domain/models"
import { PurchaseMongoRepository } from "../persistence/PurchaseMongoRepository.ts"
import { StorageProviderService } from "@/Shared/infrastructure"

export class PurchaseEventWorker implements IJob {
  async handle(args: PurchaseEvent): Promise<any | void> {
    switch (args.event) {
      case "delete":
        await new DeletePurchases(
          PurchaseMongoRepository.getInstance(),
          StorageProviderService.getInstance()
        ).execute(args.data)
        break
      case "update":
        await this.processUpdate(args)
        break
    }
  }

  private async processUpdate(args: PurchaseEvent) {
    if (args.source === "accountPayablePaid") {
      const purchase = await PurchaseMongoRepository.getInstance().one({
        "accountPayable.accountPayableId": args.data.accountPayableId,
      })

      if (!purchase) {
        return
      }

      purchase.setAccountPayable(args.data)
    }
  }
}
