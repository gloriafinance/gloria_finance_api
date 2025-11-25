import request from "supertest"
import jwt from "jsonwebtoken"
import express from "express"

import {
  BASE_PERMISSIONS,
  BASE_ROLES,
  IPermissionRepository,
  IRolePermissionRepository,
  IRoleRepository,
  IUserAssignmentRepository,
  Permission,
  Role,
  UserAssignment,
} from "@/SecuritySystem/domain"
import { CacheService } from "@/Shared/infrastructure"
import { AuthorizationService } from "@/SecuritySystem/applications/rbac/AuthorizationService"

const JWT_SECRET = "test-secret"

class InMemoryPermissionRepository implements IPermissionRepository {
  private permissions = new Map<string, Permission>()

  async findByIds(permissionIds: string[]): Promise<Permission[]> {
    return permissionIds
      .map((id) => this.permissions.get(id))
      .filter((permission): permission is Permission => Boolean(permission))
  }

  async findByModuleAction(
    module: string,
    action: string
  ): Promise<Permission | null> {
    for (const permission of this.permissions.values()) {
      const primitive = permission.toPrimitives()
      if (primitive.module === module && primitive.action === action) {
        return permission
      }
    }
    return null
  }

  async upsert(permission: Permission): Promise<void> {
    this.permissions.set(permission.getPermissionId(), permission)
  }

  async list(): Promise<Permission[]> {
    return Array.from(this.permissions.values())
  }
}

class InMemoryRoleRepository implements IRoleRepository {
  private roles = new Map<string, Role>()

  async findByRoleId(churchId: string, roleId: string): Promise<Role | null> {
    return this.roles.get(this.key(churchId, roleId)) ?? null
  }

  async findByName(churchId: string, name: string): Promise<Role | null> {
    const lower = name.toLowerCase()
    for (const role of this.roles.values()) {
      const primitive = role.toPrimitives()
      if (primitive.churchId === churchId && primitive.name.toLowerCase() === lower) {
        return role
      }
    }
    return null
  }

  async upsert(role: Role): Promise<void> {
    const primitive = role.toPrimitives()
    this.roles.set(this.key(primitive.churchId, primitive.roleId), role)
  }

  async list(churchId: string): Promise<Role[]> {
    return Array.from(this.roles.values()).filter(
      (role) => role.toPrimitives().churchId === churchId
    )
  }

  private key(churchId: string, roleId: string) {
    return `${churchId}:${roleId}`
  }
}

class InMemoryRolePermissionRepository implements IRolePermissionRepository {
  private rolePermissions = new Map<string, Set<string>>()

  async replacePermissions(
    churchId: string,
    roleId: string,
    permissionIds: string[]
  ): Promise<void> {
    this.rolePermissions.set(this.key(churchId, roleId), new Set(permissionIds))
  }

  async findPermissionIdsByRole(
    churchId: string,
    roleId: string
  ): Promise<string[]> {
    return Array.from(
      this.rolePermissions.get(this.key(churchId, roleId)) ?? new Set()
    )
  }

  async findPermissionIdsByRoles(
    churchId: string,
    roleIds: string[]
  ): Promise<string[]> {
    const permissions = new Set<string>()
    for (const roleId of roleIds) {
      const values = this.rolePermissions.get(this.key(churchId, roleId))
      values?.forEach((permissionId) => permissions.add(permissionId))
    }
    return Array.from(permissions)
  }

  private key(churchId: string, roleId: string) {
    return `${churchId}:${roleId}`
  }
}

class InMemoryUserAssignmentRepository implements IUserAssignmentRepository {
  private assignments = new Map<string, UserAssignment>()

  async assignRoles(
    churchId: string,
    userId: string,
    roles: string[]
  ): Promise<UserAssignment> {
    const assignment = UserAssignment.create(churchId, userId, roles)
    this.assignments.set(this.key(churchId, userId), assignment)
    return assignment
  }

  async findByUser(
    churchId: string,
    userId: string
  ): Promise<UserAssignment | null> {
    return this.assignments.get(this.key(churchId, userId)) ?? null
  }

  async findUserIdsByRole(
    churchId: string,
    roleId: string
  ): Promise<string[]> {
    const result: string[] = []
    for (const assignment of this.assignments.values()) {
      const primitive = assignment.toPrimitives()
      if (primitive.churchId === churchId && primitive.roles.includes(roleId)) {
        result.push(primitive.userId)
      }
    }
    return result
  }

  private key(churchId: string, userId: string) {
    return `${churchId}:${userId}`
  }
}

const buildToken = (payload: Record<string, any>) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" })

describe("RBAC endpoints", () => {
  let app: express.Express
  let permissionRepository: InMemoryPermissionRepository
  let roleRepository: InMemoryRoleRepository
  let rolePermissionRepository: InMemoryRolePermissionRepository
  let assignmentRepository: InMemoryUserAssignmentRepository

  beforeEach(async () => {
    jest.resetModules()
    process.env.JWT_SECRET = JWT_SECRET
    delete process.env.REDIS_URL

    permissionRepository = new InMemoryPermissionRepository()
    roleRepository = new InMemoryRoleRepository()
    rolePermissionRepository = new InMemoryRolePermissionRepository()
    assignmentRepository = new InMemoryUserAssignmentRepository()

    const {
      PermissionMongoRepository,
    } = await import("@/SecuritySystem/infrastructure/persistence/PermissionMongoRepository")
    jest
      .spyOn(PermissionMongoRepository, "getInstance")
      .mockReturnValue(permissionRepository as any)

    const {
      RoleMongoRepository,
    } = await import("@/SecuritySystem/infrastructure/persistence/RoleMongoRepository")
    jest.spyOn(RoleMongoRepository, "getInstance").mockReturnValue(roleRepository as any)

    const {
      RolePermissionMongoRepository,
    } = await import(
      "@/SecuritySystem/infrastructure/persistence/RolePermissionMongoRepository"
    )
    jest
      .spyOn(RolePermissionMongoRepository, "getInstance")
      .mockReturnValue(rolePermissionRepository as any)

    const {
      UserAssignmentMongoRepository,
    } = await import(
      "@/SecuritySystem/infrastructure/persistence/UserAssignmentMongoRepository"
    )
    jest
      .spyOn(UserAssignmentMongoRepository, "getInstance")
      .mockReturnValue(assignmentRepository as any)

    const cache = CacheService.getInstance()
    AuthorizationService.getInstance(
      assignmentRepository as any,
      rolePermissionRepository as any,
      permissionRepository as any,
      cache
    )

    seedBaseData()

    const rbacRouter = (
      await import("@/SecuritySystem/infrastructure/http/routes/rbac.routes")
    ).default

    app = express()
    app.use(express.json())
    app.use("/api/v1/rbac", rbacRouter)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const seedBaseData = () => {
    for (const definition of BASE_PERMISSIONS) {
      permissionRepository.upsert(
        Permission.create({
          permissionId: definition.permissionId,
          module: definition.module,
          action: definition.action,
          description: definition.description,
          isSystem: Boolean(definition.isSystem),
        })
      )
    }

    for (const roleDefinition of BASE_ROLES) {
      const role = Role.create(
        "church-1",
        roleDefinition.name,
        roleDefinition.description,
        Boolean(roleDefinition.isSystem),
        roleDefinition.roleId
      )
      roleRepository.upsert(role)
      rolePermissionRepository.replacePermissions(
        "church-1",
        roleDefinition.roleId,
        roleDefinition.permissions
      )
    }

    assignmentRepository.assignRoles("church-1", "user-admin", ["ADMIN"])
    assignmentRepository.assignRoles("church-1", "user-auditor", ["AUDITOR"])
    assignmentRepository.assignRoles("church-1", "user-team", ["PASTOR", "TESORERO"])
  }

  it("allows ADMIN users to create custom roles", async () => {
    const token = buildToken({
      userId: "user-admin",
      churchId: "church-1",
      email: "admin@test.com",
      name: "Admin",
    })

    const response = await request(app)
      .post("/api/v1/rbac/roles")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Supervisor", description: "Custom role" })
      .expect(201)

    expect(response.body.data.roleId).toBeDefined()
    const storedRoles = await roleRepository.list("church-1")
    expect(storedRoles.some((role) => role.getName() === "Supervisor")).toBe(true)
  })

  it("prevents updating permissions for system roles", async () => {
    const token = buildToken({
      userId: "user-admin",
      churchId: "church-1",
      email: "admin@test.com",
      name: "Admin",
    })

    const response = await request(app)
      .post("/api/v1/rbac/roles/ADMIN/permissions")
      .set("Authorization", `Bearer ${token}`)
      .send({ permissionIds: [] })
      .expect(400)

    expect(response.body.code).toBe("SYSTEM_ROLE_MODIFICATION_NOT_ALLOWED")
  })

  it("rejects role assignment when user lacks permission", async () => {
    const token = buildToken({
      userId: "user-auditor",
      churchId: "church-1",
      email: "auditor@test.com",
      name: "Auditor",
    })

    await request(app)
      .post("/api/v1/rbac/users/user-admin/assignments")
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["PASTOR"] })
      .expect(403)
  })

  it("combines permissions from multiple roles", async () => {
    const token = buildToken({
      userId: "user-admin",
      churchId: "church-1",
      email: "admin@test.com",
      name: "Admin",
    })

    const response = await request(app)
      .get("/api/v1/rbac/users/user-team/permissions")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)

    expect(response.body.data.roles).toEqual(["PASTOR", "TESORERO"])
    expect(response.body.data.permissions).toEqual(
      expect.arrayContaining([
        "financial_records:read",
        "financial_records:create",
        "accounts_payable:manage",
      ])
    )
  })

  it("retrieves the permissions assigned to a role", async () => {
    const token = buildToken({
      userId: "user-admin",
      churchId: "church-1",
      email: "admin@test.com",
      name: "Admin",
    })

    const response = await request(app)
      .get("/api/v1/rbac/roles/PASTOR/permissions")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)

    expect(response.body.data.role.roleId).toBe("PASTOR")
    expect(response.body.data.permissions.length).toBeGreaterThan(0)
    expect(response.body.data.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          permissionId: expect.stringContaining(":"),
        }),
      ])
    )
  })
})
