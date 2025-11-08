import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { IRoleRepository, Role } from "@/SecuritySystem/domain"

export class RoleMongoRepository
  extends MongoRepository<Role>
  implements IRoleRepository
{
  private static instance: RoleMongoRepository

  static getInstance(): RoleMongoRepository {
    if (!RoleMongoRepository.instance) {
      RoleMongoRepository.instance = new RoleMongoRepository()
    }

    return RoleMongoRepository.instance
  }

  collectionName(): string {
    return "roles"
  }

  async findByRoleId(churchId: string, roleId: string): Promise<Role | null> {
    const collection = await this.collection()
    const document = await collection.findOne({ churchId, roleId })

    if (!document) {
      return null
    }

    return Role.fromPrimitives({
      ...document,
      id: document._id?.toString(),
    })
  }

  async findByName(churchId: string, name: string): Promise<Role | null> {
    const collection = await this.collection()
    const document = await collection.findOne({
      churchId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    })

    if (!document) {
      return null
    }

    return Role.fromPrimitives({
      ...document,
      id: document._id?.toString(),
    })
  }

  async upsert(role: Role): Promise<void> {
    const collection = await this.collection()
    const primitive = role.toPrimitives()
    const { id, ...rest } = primitive

    await collection.updateOne(
      { churchId: primitive.churchId, roleId: primitive.roleId },
      { $set: rest },
      { upsert: true }
    )
  }

  async list(churchId: string): Promise<Role[]> {
    const collection = await this.collection()
    const documents = await collection.find({ churchId }).toArray()

    return documents.map((document) =>
      Role.fromPrimitives({
        ...document,
        id: document._id?.toString(),
      })
    )
  }
}
