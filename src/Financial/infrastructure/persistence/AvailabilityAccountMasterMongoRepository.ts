import { IAvailabilityAccountMasterRepository } from "../../domain/interfaces"
import { AvailabilityAccountMaster } from "../../domain"
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"

export class AvailabilityAccountMasterMongoRepository
  extends MongoRepository<AvailabilityAccountMaster>
  implements IAvailabilityAccountMasterRepository
{
  private static instance: AvailabilityAccountMasterMongoRepository

  constructor() {
    super()
  }

  static getInstance(): AvailabilityAccountMasterMongoRepository {
    if (!AvailabilityAccountMasterMongoRepository.instance) {
      AvailabilityAccountMasterMongoRepository.instance =
        new AvailabilityAccountMasterMongoRepository()
    }
    return AvailabilityAccountMasterMongoRepository.instance
  }

  collectionName(): string {
    return "availability_accounts_master"
  }

  async one(
    availabilityAccountMasterId: string
  ): Promise<AvailabilityAccountMaster | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne({
      availabilityAccountMasterId,
    })
    return document
      ? AvailabilityAccountMaster.fromPrimitives({
          ...document,
          id: document._id,
        })
      : undefined
  }

  async upsert(accountMaster: AvailabilityAccountMaster): Promise<void> {
    const collection = await this.collection()

    await collection.updateOne(
      {
        availabilityAccountMasterId:
          accountMaster.getAvailabilityAccountMasterId(),
      },
      { $set: accountMaster.toPrimitives() },
      { upsert: true }
    )
  }

  async search(
    churchId: string,
    month: number,
    year: number
  ): Promise<AvailabilityAccountMaster[] | undefined> {
    const collection = await this.collection()

    const documents = await collection
      .aggregate([
        {
          $search: {
            index: "availabilityAccountMasterIndex",
            compound: {
              must: [
                { text: { query: churchId, path: "churchId" } },
                { equals: { value: month, path: "month" } },
                { equals: { value: year, path: "year" } },
              ],
            },
          },
        },
      ])
      .toArray()

    if (!documents) {
      return undefined
    }

    return documents.map((document) =>
      AvailabilityAccountMaster.fromPrimitives({
        ...document,
        id: document._id,
      })
    )
  }
}
