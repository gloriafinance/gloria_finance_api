import { States } from "../../domain"
import type { IWorldRepository } from "../../domain"
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Collection } from "mongodb"

export class WorldMongoRepository
  extends MongoRepository<any>
  implements IWorldRepository
{
  private static instance: WorldMongoRepository
  private collectName: string = "states"

  constructor() {
    super(States)
  }

  static getInstance(): WorldMongoRepository {
    if (!WorldMongoRepository.instance) {
      WorldMongoRepository.instance = new WorldMongoRepository()
    }
    return WorldMongoRepository.instance
  }

  collectionName(): string {
    return this.collectName
  }

  async findStateById(stateId: string): Promise<States> {
    const collection = await this.collection()
    const result = await collection.findOne({ stateId: stateId })
    if (!result) {
      return undefined
    }

    return States.fromPrimitives({ ...result, id: result._id })
  }

  async findByCountryId(countryId: string): Promise<States[]> {
    const collection = await this.collection()
    const result = await collection.find({ countryId: countryId }).toArray()
    return result.map((state) =>
      States.fromPrimitives({ ...state, id: state._id })
    )
  }

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
