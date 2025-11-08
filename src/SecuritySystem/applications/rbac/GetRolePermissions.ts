import {
  ActionNotAllowed,
  IPermissionRepository,
  IRolePermissionRepository,
  IRoleRepository,
  Permission,
  Role,
} from "@/SecuritySystem/domain"

export type GetRolePermissionsRequest = {
  churchId: string
  roleId: string
}

export type GetRolePermissionsResponse = {
  role: ReturnType<Role["toPrimitives"]>
  permissions: Array<ReturnType<Permission["toPrimitives"]>>
}

export class GetRolePermissions {
  constructor(
    private readonly roleRepository: IRoleRepository,
    private readonly rolePermissionRepository: IRolePermissionRepository,
    private readonly permissionRepository: IPermissionRepository
  ) {}

  async execute(
    request: GetRolePermissionsRequest
  ): Promise<GetRolePermissionsResponse> {
    const role = await this.roleRepository.findByRoleId(
      request.churchId,
      request.roleId
    )

    if (!role) {
      throw new ActionNotAllowed()
      //`Role ${request.roleId} not found in church ${request.churchId}`
    }

    const permissionIds =
      await this.rolePermissionRepository.findPermissionIdsByRole(
        request.churchId,
        request.roleId
      )

    if (!permissionIds.length) {
      return {
        role: role.toPrimitives(),
        permissions: [],
      }
    }

    const permissions = await this.permissionRepository.findByIds(permissionIds)
    const permissionMap = new Map(
      permissions.map((permission) => [
        permission.getPermissionId(),
        permission.toPrimitives(),
      ])
    )

    const orderedPermissions = permissionIds
      .map((permissionId) => permissionMap.get(permissionId))
      .filter(
        (permission): permission is ReturnType<Permission["toPrimitives"]> =>
          Boolean(permission)
      )

    return {
      role: role.toPrimitives(),
      permissions: orderedPermissions,
    }
  }
}
