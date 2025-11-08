import { IPermissionRepository } from "@/SecuritySystem/domain"

export class ListPermissions {
  constructor(private readonly permissionRepository: IPermissionRepository) {}

  async execute() {
    const permissions = await this.permissionRepository.list()
    return permissions.map((permission) => permission.toPrimitives())
  }
}
