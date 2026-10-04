import {
  type AggregateRelations,
  MongoRepository,
} from "@abejarano/ts-mongodb-criteria"
import { IRolePermissionRepository } from "@/SecuritySystem/domain"
import { Collection } from "mongodb"

/**
 * Marcador de la colección `role_permissions`. Este repositorio sólo usa el
 * driver nativo, así que no hidrata agregados: la clase existe para declarar
 * la colección que el repositorio hereda de MongoRepository.
 */
class RolePermissionDocument {
  static collectionName(): string {
    return "role_permissions"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(
    data: Record<string, unknown>
  ): Record<string, unknown> {
    return data
  }
}

export class RolePermissionMongoRepository
  extends MongoRepository<any>
  implements IRolePermissionRepository
{
  private static instance: RolePermissionMongoRepository

  private constructor() {
    super(RolePermissionDocument)
  }

  static getInstance(): RolePermissionMongoRepository {
    if (!RolePermissionMongoRepository.instance) {
      RolePermissionMongoRepository.instance =
        new RolePermissionMongoRepository()
    }

    return RolePermissionMongoRepository.instance
  }

  async replacePermissions(
    churchId: string,
    roleId: string,
    permissionIds: string[]
  ): Promise<void> {
    const collection = await this.collection<any>()

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

    const collection = await this.collection<any>()
    const documents = await collection
      .find({ churchId, roleId: { $in: roleIds } })
      .toArray()

    return documents.map((document) => document.permissionId)
  }

  async findPermissionIdsByRole(
    churchId: string,
    roleId: string
  ): Promise<string[]> {
    const collection = await this.collection<any>()
    const documents = await collection.find({ churchId, roleId }).toArray()

    return documents.map((document) => document.permissionId)
  }

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
