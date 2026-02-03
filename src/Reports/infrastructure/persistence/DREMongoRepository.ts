import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { DREMaster, type IDRERepository } from "@/Reports/domain"
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

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
