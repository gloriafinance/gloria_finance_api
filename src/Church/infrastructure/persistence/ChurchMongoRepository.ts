import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Church, type IChurchRepository } from "../../domain"
import { Collection } from "mongodb"
import { randomBytes } from "crypto"

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

  async all(filter: object): Promise<Church[]> {
    const collection = await this.collection()
    const result = await collection.find(filter).toArray()
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

  async getOrCreateMemberRegistrationToken(churchId: string): Promise<string> {
    const collection = await this.collection()
    const token = `mreg_${randomBytes(32).toString("hex")}`

    const result = await collection.findOneAndUpdate(
      { churchId, "memberRegistration.token": { $exists: false } },
      {
        $set: {
          "memberRegistration.token": token,
          "memberRegistration.createdAt": new Date(),
        },
      },
      { returnDocument: "after" }
    )

    if (result?.memberRegistration?.token) {
      return result.memberRegistration.token as string
    }

    const existing = await collection.findOne(
      { churchId },
      { projection: { "memberRegistration.token": 1 } }
    )
    if (existing?.memberRegistration?.token) {
      return existing.memberRegistration.token as string
    }

    throw new Error(
      `Unable to resolve member registration token for church ${churchId}`
    )
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { wabaId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          wabaId: { $type: "string" },
        },
      }
    )

    await collection.createIndex(
      { phoneNumberId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          phoneNumberId: { $type: "string" },
        },
      }
    )

    await collection.createIndex(
      { "memberRegistration.token": 1 },
      {
        unique: true,
        name: "idx_church_member_registration_token",
        partialFilterExpression: {
          "memberRegistration.token": { $exists: true, $type: "string" },
        },
      }
    )
  }
}
