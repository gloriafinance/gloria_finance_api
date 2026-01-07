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

  private constructor() {
    super(Purchase)
  }

  static getInstance(): PurchaseMongoRepository {
    if (!this.instance) {
      this.instance = new PurchaseMongoRepository()
    }
    return this.instance
  }

  collectionName(): string {
    return "purchases"
  }

  async delete(purchaseIds: string[]): Promise<void> {
    const collection = await this.collection()

    await collection.deleteMany({ purchaseId: { $in: purchaseIds } })
  }

  list(criteria: Criteria): Promise<Paginate<PurchaseModel>>

  list(purchaseIds: string[]): Promise<Purchase[]>
  override async list(
    purchaseIds: string[] | Criteria
  ): Promise<Purchase[] | Paginate<PurchaseModel>> {
    if (purchaseIds instanceof Criteria) {
      return super.list(purchaseIds)
    }

    const collection = await this.collection()

    const purchases = await collection
      .find({ purchaseId: { $in: purchaseIds } })
      .toArray()

    return purchases.map((p) =>
      Purchase.fromPrimitives({ ...p, id: p._id.toString() })
    )
  }
}
