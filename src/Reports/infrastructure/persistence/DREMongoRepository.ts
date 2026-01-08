import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { DREMaster, IDRERepository } from "@/Reports/domain"
import { Collection } from "mongodb"

export class DREMongoRepository
  extends MongoRepository<DREMaster>
  implements IDRERepository
{
  private static instance: DREMongoRepository
  private dbCollectionName: string = "dre_masters"

  private constructor() {
    super(DREMaster)
  }

  static getInstance(): DREMongoRepository {
    if (DREMongoRepository.instance) {
      return DREMongoRepository.instance
    }
    DREMongoRepository.instance = new DREMongoRepository()
    return DREMongoRepository.instance
  }

  collectionName(): string {
    return this.dbCollectionName
  }

  async one(params: {
    churchId: string
    month: number
    year: number
  }): Promise<DREMaster | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne(params)

    if (!result) {
      return undefined
    }

    return DREMaster.fromPrimitives({
      id: result._id.toString(),
      ...result,
    })
  }

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
