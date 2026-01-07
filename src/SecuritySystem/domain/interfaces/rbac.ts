import { Permission, Role, UserAssignment } from "../index"
import { Criteria, IRepository, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IPermissionRepository extends IRepository<Permission> {
  findByIds(permissionIds: string[]): Promise<Permission[]>

  findByModuleAction(module: string, action: string): Promise<Permission | null>

  list(): Promise<Permission[]>

  list(criteria: Criteria): Promise<Paginate<Permission>>
}

export interface IRoleRepository extends IRepository<Role> {
  findByRoleId(churchId: string, roleId: string): Promise<Role | null>

  findByName(churchId: string, name: string): Promise<Role | null>

  list(churchId: string): Promise<Role[]>
  list(criteria: Criteria): Promise<Paginate<Role>>
}

export interface IRolePermissionRepository {
  replacePermissions(
    churchId: string,
    roleId: string,
    permissionIds: string[]
  ): Promise<void>

  findPermissionIdsByRole(churchId: string, roleId: string): Promise<string[]>

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
