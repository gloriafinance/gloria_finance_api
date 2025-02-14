import { MongoRepository } from "../../../Shared/infrastructure"
import { Purchase } from "../../domain"
import { IPurchaseRepository } from "../../domain/interfaces"
import { Criteria, Paginate } from "../../../Shared/domain"
import { Purchase as PurchaseModel } from "../../domain/models"

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

    return this.buildPaginate<PurchaseModel>(result)
  }
}
