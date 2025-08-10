import { MongoRepository } from "../../../Shared/infrastructure"
import { AvailabilityAccount } from "../../domain"
import { IAvailabilityAccountRepository } from "../../domain/interfaces"

export class AvailabilityAccountMongoRepository
  extends MongoRepository<AvailabilityAccount>
  implements IAvailabilityAccountRepository
{
  private static instance: AvailabilityAccountMongoRepository

  static getInstance(): AvailabilityAccountMongoRepository {
    if (!this.instance) {
      this.instance = new AvailabilityAccountMongoRepository()
    }
    return this.instance
  }

  collectionName(): string {
    return "availability_accounts"
  }

  async upsert(availabilityAccount: AvailabilityAccount): Promise<void> {
    const collection = await this.collection()
    await collection.updateOne(
      {
        availabilityAccountId: availabilityAccount.getAvailabilityAccountId(),
      },
      { $set: availabilityAccount },
      { upsert: true }
    )
  }

  async one(filter: object): Promise<AvailabilityAccount | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne(filter)

    if (!document) {
      return undefined
    }

    return AvailabilityAccount.fromPrimitives({
      ...document,
      id: document._id,
    })
  }

  async searchAvailabilityAccountsByChurchId(
    churchId: string
  ): Promise<AvailabilityAccount[]> {
    const collection = await this.collection()
    const documents = await collection.find({ churchId }).toArray()

    return documents.map((document) =>
      AvailabilityAccount.fromPrimitives({
        ...document,
        id: document._id,
      })
    )
  }
}
