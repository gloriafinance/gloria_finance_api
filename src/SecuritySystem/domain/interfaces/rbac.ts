import { Permission, Role, UserAssignment } from "../index"

export interface IPermissionRepository {
  findByIds(permissionIds: string[]): Promise<Permission[]>
  findByModuleAction(module: string, action: string): Promise<Permission | null>
  upsert(permission: Permission): Promise<void>
  list(): Promise<Permission[]>
}

export interface IRoleRepository {
  findByRoleId(churchId: string, roleId: string): Promise<Role | null>
  findByName(churchId: string, name: string): Promise<Role | null>
  upsert(role: Role): Promise<void>
  list(churchId: string): Promise<Role[]>
}

export interface IRolePermissionRepository {
  replacePermissions(
    churchId: string,
    roleId: string,
    permissionIds: string[]
  ): Promise<void>
  findPermissionIdsByRole(
    churchId: string,
    roleId: string
  ): Promise<string[]>
  findPermissionIdsByRoles(
    churchId: string,
    roleIds: string[]
  ): Promise<string[]>
}

export interface IUserAssignmentRepository {
  assignRoles(
    churchId: string,
    userId: string,
    roles: string[]
  ): Promise<UserAssignment>
  findByUser(churchId: string, userId: string): Promise<UserAssignment | null>
  findUserIdsByRole(churchId: string, roleId: string): Promise<string[]>
}
