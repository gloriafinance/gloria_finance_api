import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { IPermissionRepository, Permission } from "@/SecuritySystem/domain"

export class PermissionMongoRepository
  extends MongoRepository<Permission>
  implements IPermissionRepository
{
  private static instance: PermissionMongoRepository

  static getInstance(): PermissionMongoRepository {
    if (!PermissionMongoRepository.instance) {
      PermissionMongoRepository.instance = new PermissionMongoRepository()
    }

    return PermissionMongoRepository.instance
  }

  collectionName(): string {
    return "permissions"
  }

  async findByIds(permissionIds: string[]): Promise<Permission[]> {
    if (!permissionIds.length) {
      return []
    }

    const collection = await this.collection()
    const documents = await collection
      .find({ permissionId: { $in: permissionIds } })
      .toArray()

    return documents.map((document) =>
      Permission.fromPrimitives({
        ...document,
        id: document._id?.toString(),
      })
    )
  }

  async findByModuleAction(
    module: string,
    action: string
  ): Promise<Permission | null> {
    const collection = await this.collection()
    const document = await collection.findOne({ module, action })

    if (!document) {
      return null
    }

    return Permission.fromPrimitives({
      ...document,
      id: document._id?.toString(),
    })
  }

  async upsert(permission: Permission): Promise<void> {
    const collection = await this.collection()
    const primitive = permission.toPrimitives()
    const { id, ...rest } = primitive

    await collection.updateOne(
      { permissionId: primitive.permissionId },
      { $set: rest },
      { upsert: true }
    )
  }

  async list(): Promise<Permission[]> {
    const collection = await this.collection()
    const documents = await collection.find({}).toArray()

    return documents.map((document) =>
      Permission.fromPrimitives({
        ...document,
        id: document._id?.toString(),
      })
    )
  }
}
