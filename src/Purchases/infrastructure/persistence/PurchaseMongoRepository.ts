import { MongoRepository } from "../../../Shared/infrastructure"
import { Purchase } from "../../domain"
import { IPurchaseRepository } from "../../domain/interfaces"

export class PurchaseMongoRepository
  extends MongoRepository<Purchase>
  implements IPurchaseRepository
{
  private static instance: PurchaseMongoRepository

  static getInstance(): PurchaseMongoRepository {
    if (!this.instance) {
      this.instance = new PurchaseMongoRepository()
    }
    return this.instance
  }

  collectionName(): string {
    return "purchases"
  }

  async upsert(purchase: Purchase): Promise<void> {
    await this.persist(purchase.getId(), purchase)
  }
}
