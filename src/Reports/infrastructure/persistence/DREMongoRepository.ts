import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { DREMaster, type IDRERepository } from "@/Reports/domain"
import { Collection } from "mongodb"

export class DREMongoRepository
  extends MongoRepository<DREMaster>
  implements IDRERepository
{
  private static instance: DREMongoRepository

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

  async invalidate(input: {
    churchId: string
    month: number
    year: number
  }): Promise<void> {
    const collection = await this.collection()
    await collection.deleteOne({
      churchId: input.churchId,
      month: input.month,
      year: input.year,
    })
  }

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
