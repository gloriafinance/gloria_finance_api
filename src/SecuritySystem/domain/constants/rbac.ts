export type BasePermissionDefinition = {
  permissionId: string
  module: string
  action: string
  description: string
  isSystem?: boolean
}

export type BaseRoleDefinition = {
  roleId: string
  name: string
  description: string
  permissions: string[]
  isSystem?: boolean
}

const basePermissionsFixture =
  require("../../../fixtures/rbacPermissions.json") as BasePermissionDefinition[]
const baseRolesFixture =
  require("../../../fixtures/rbacRoles.json") as BaseRoleDefinition[]

export const BASE_PERMISSIONS: BasePermissionDefinition[] =
  basePermissionsFixture
export const BASE_ROLES: BaseRoleDefinition[] = baseRolesFixture
