import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { AvailabilityAccount } from "@/FinanceConfig/domain/AvailabilityAccount"
import type { IAvailabilityAccountRepository } from "@/FinanceConfig/domain/interfaces/AvailabilityAccountRepository.interface"
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

  async deleteByAvailabilityAccountId(
    availabilityAccountId: string
  ): Promise<void> {
    const collection = await this.collection()
    await collection.deleteOne({ availabilityAccountId })
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({ availabilityAccountId: 1 }, { unique: true })
    await collection.createIndex({
      "source.bankId": 1,
    })
  }
}
