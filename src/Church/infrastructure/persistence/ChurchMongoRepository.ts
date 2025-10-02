import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { Church, ChurchDTO, IChurchRepository } from "../../domain"

export class ChurchMongoRepository
  extends MongoRepository<Church>
  implements IChurchRepository
{
  private static instance: ChurchMongoRepository

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

  async one(churchId: string): Promise<Church | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({ churchId: churchId })

    if (!result) {
      return undefined
    }
    return Church.fromPrimitives({ id: result._id.toString(), ...result })
  }

  async upsert(church: Church): Promise<void> {
    await this.persist(church.getId(), church)
  }

  async all(): Promise<Church[]> {
    const collection = await this.collection()
    const result = await collection.find().toArray()
    return result.map((r) =>
      Church.fromPrimitives({ id: r._id.toString(), ...r })
    )
  }

  async list(criteria: Criteria): Promise<Paginate<ChurchDTO>> {
    const result: ChurchDTO[] = await this.searchByCriteria<ChurchDTO>(
      criteria,
      ["financialConcepts", "members"]
    )
    return this.paginate<ChurchDTO>(result)
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
