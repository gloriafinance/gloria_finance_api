import {
  IPermissionRepository,
  IRolePermissionRepository,
  IRoleRepository,
  Role,
} from "@/SecuritySystem/domain"
import { ActionNotAllowed } from "@/SecuritySystem/domain/exceptions/ActionNotAllowed"

export type AssignPermissionsToRoleRequest = {
  churchId: string
  roleId: string
  permissionIds: string[]
}

export class AssignPermissionsToRole {
  constructor(
    private readonly roleRepository: IRoleRepository,
    private readonly permissionRepository: IPermissionRepository,
    private readonly rolePermissionRepository: IRolePermissionRepository
  ) {}

  async execute(request: AssignPermissionsToRoleRequest): Promise<Role> {
    const role = await this.roleRepository.findByRoleId(
      request.churchId,
      request.roleId
    )

    if (!role) {
      throw new ActionNotAllowed()
      //`Role ${request.roleId} not found in church ${request.churchId}`
    }

    const permissions = await this.permissionRepository.findByIds(
      request.permissionIds
    )

    if (permissions.length !== request.permissionIds.length) {
      throw new ActionNotAllowed()
      //"Some permissions do not exist in catalog"
    }

    await this.rolePermissionRepository.replacePermissions(
      request.churchId,
      request.roleId,
      request.permissionIds
    )

    return role
  }
}
