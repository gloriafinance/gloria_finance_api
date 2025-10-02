import { Purchase } from "../../domain"
import { IPurchaseRepository } from "../../domain/interfaces"
import { Purchase as PurchaseModel } from "../../domain/models"
import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"

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

  async fetch(criteria: Criteria): Promise<Paginate<PurchaseModel>> {
    const result = await this.searchByCriteria<PurchaseModel>(criteria)

    return this.paginate<PurchaseModel>(result)
  }
}
