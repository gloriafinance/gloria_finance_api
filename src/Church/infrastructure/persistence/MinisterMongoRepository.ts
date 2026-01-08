import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { IMinisterRepository, Minister } from "../../domain"
import { Collection } from "mongodb"

export class MinisterMongoRepository
  extends MongoRepository<Minister>
  implements IMinisterRepository
{
  private static instance: MinisterMongoRepository

  private constructor() {
    super(Minister)
  }

  static getInstance(): MinisterMongoRepository {
    if (!MinisterMongoRepository.instance) {
      MinisterMongoRepository.instance = new MinisterMongoRepository()
    }
    return MinisterMongoRepository.instance
  }

  collectionName(): string {
    return "ministers"
  }

  async findByDni(dni: string): Promise<Minister | undefined> {
    return await this.buildMinister({ dni })
  }

  async findById(ministerId: string): Promise<Minister | undefined> {
    return await this.buildMinister({ ministerId })
  }

  public async allActive() {
    const collection = await this.collection()
    const result = await collection.find().toArray()

    return result.map((minister) =>
      Minister.fromPrimitives({
        id: minister._id.toString(),
        ...minister,
      })
    )
  }

  public async withoutAssignedChurch(): Promise<Minister[]> {
    const collection = await this.collection()
    const result = await collection
      .find({ church: { $exists: false } })
      .toArray()
    return result.map((minister) =>
      Minister.fromPrimitives({
        id: minister._id.toString(),
        ...minister,
      })
    )
  }

  async hasAnAssignedChurch(ministerId: string): Promise<[boolean, Minister]> {
    const collection = await this.collection()
    const result = await collection.findOne({
      ministerId,
      churchId: null,
    })

    if (!result) {
      return [true, undefined]
    }
    return [
      false,
      Minister.fromPrimitives({ id: result._id.toString(), ...result }),
    ]
  }

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }

  private async buildMinister(filter: {}): Promise<Minister> {
    const collection = await this.collection()
    const result = await collection.findOne(filter)
    if (!result) return undefined

    return Minister.fromPrimitives({ id: result._id.toString(), ...result })
  }
}
