import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Church, IChurchRepository } from "../../domain"

export class ChurchMongoRepository
  extends MongoRepository<Church>
  implements IChurchRepository
{
  private static instance: ChurchMongoRepository

  private constructor() {
    super(Church)
  }

  static getInstance(): ChurchMongoRepository {
    if (ChurchMongoRepository.instance) {
      return ChurchMongoRepository.instance
    }
    ChurchMongoRepository.instance = new ChurchMongoRepository()
    return ChurchMongoRepository.instance
  }

  collectionName(): string {
    return "churches"
  }

  async findById(churchId: string): Promise<Church | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({ churchId: churchId })

    if (!result) {
      return undefined
    }
    return Church.fromPrimitives({ id: result._id.toString(), ...result })
  }

  async all(): Promise<Church[]> {
    const collection = await this.collection()
    const result = await collection.find().toArray()
    return result.map((r) =>
      Church.fromPrimitives({ id: r._id.toString(), ...r })
    )
  }

  async hasAnAssignedMinister(
    churchId: string
  ): Promise<[boolean, Church | undefined]> {
    const collection = await this.collection()
    const result = await collection.findOne({
      churchId,
      ministerId: null,
    })

    if (!result) {
      return [true, undefined]
    }
    return [
      false,
      Church.fromPrimitives({ id: result._id.toString(), ...result }),
    ]
  }

  async withoutAssignedMinister(): Promise<Church[]> {
    const collection = await this.collection()
    const result = await collection.find({ ministerId: null }).toArray()

    return result.map((church) =>
      Church.fromPrimitives({ id: church._id.toString(), ...church })
    )
  }

  async listByDistrictId(districtId: string): Promise<Church[]> {
    const collection = await this.collection()
    const result = await collection.find({ districtId }).toArray()

    return result.map((church) =>
      Church.fromPrimitives({ id: church._id.toString(), ...church })
    )
  }
}
