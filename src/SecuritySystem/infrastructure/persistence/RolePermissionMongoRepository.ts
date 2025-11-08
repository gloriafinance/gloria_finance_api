import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { IRolePermissionRepository } from "@/SecuritySystem/domain"

export class RolePermissionMongoRepository
  extends MongoRepository<any>
  implements IRolePermissionRepository
{
  private static instance: RolePermissionMongoRepository

  static getInstance(): RolePermissionMongoRepository {
    if (!RolePermissionMongoRepository.instance) {
      RolePermissionMongoRepository.instance =
        new RolePermissionMongoRepository()
    }

    return RolePermissionMongoRepository.instance
  }

  collectionName(): string {
    return "role_permissions"
  }

  async replacePermissions(
    churchId: string,
    roleId: string,
    permissionIds: string[]
  ): Promise<void> {
    const collection = await this.collection()

    await collection.deleteMany({ churchId, roleId })

    if (!permissionIds.length) {
      return
    }

    await collection.insertMany(
      permissionIds.map((permissionId) => ({
        churchId,
        roleId,
        permissionId,
      }))
    )
  }

  async findPermissionIdsByRoles(
    churchId: string,
    roleIds: string[]
  ): Promise<string[]> {
    if (!roleIds.length) {
      return []
    }

    const collection = await this.collection()
    const documents = await collection
      .find({ churchId, roleId: { $in: roleIds } })
      .toArray()

    return documents.map((document) => document.permissionId)
  }

  async findPermissionIdsByRole(
    churchId: string,
    roleId: string
  ): Promise<string[]> {
    const collection = await this.collection()
    const documents = await collection.find({ churchId, roleId }).toArray()

    return documents.map((document) => document.permissionId)
  }
}
