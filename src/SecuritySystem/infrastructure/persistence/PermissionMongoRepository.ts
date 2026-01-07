import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { IPermissionRepository, Permission } from "@/SecuritySystem/domain"

export class PermissionMongoRepository
  extends MongoRepository<Permission>
  implements IPermissionRepository
{
  private static instance: PermissionMongoRepository

  private constructor() {
    super(Permission)
  }

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

  list(): Promise<Permission[]>

  list(criteria: Criteria): Promise<Paginate<Permission>>
  override async list(): Promise<Permission[] | Paginate<Permission>> {
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
