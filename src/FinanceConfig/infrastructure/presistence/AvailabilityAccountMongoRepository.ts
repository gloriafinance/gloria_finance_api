import {
  Criteria,
  MongoRepository,
  type Paginate,
} from "@abejarano/ts-mongodb-criteria"
import {
  AvailabilityAccount,
  type IAvailabilityAccountRepository,
} from "@/FinanceConfig/domain"
import { Collection } from "mongodb"

export class AvailabilityAccountMongoRepository
  extends MongoRepository<AvailabilityAccount>
  implements IAvailabilityAccountRepository
{
  private static instance: AvailabilityAccountMongoRepository

  private constructor() {
    super(AvailabilityAccount)
  }

  static getInstance(): AvailabilityAccountMongoRepository {
    if (!this.instance) {
      this.instance = new AvailabilityAccountMongoRepository()
    }
    return this.instance
  }

  collectionName(): string {
    return "availability_accounts"
  }

  override list(filter: object): Promise<AvailabilityAccount[]>
  override list(criteria: Criteria): Promise<Paginate<AvailabilityAccount>>

  override async list(
    filter: object | Criteria
  ): Promise<AvailabilityAccount[] | Paginate<AvailabilityAccount>> {
    const collection = await this.collection()
    const documents = await collection.find(filter).toArray()

    return documents.map((document) =>
      AvailabilityAccount.fromPrimitives({
        ...document,
        id: document._id,
      })
    )
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({ availabilityAccountId: 1 }, { unique: true })
  }
}
