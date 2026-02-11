import {
  BASE_PERMISSIONS,
  BASE_ROLES,
  type IPasswordAdapter,
  type IPermissionRepository,
  type IRolePermissionRepository,
  type IRoleRepository,
  type IUserAssignmentRepository,
  type IUserRepository,
  Permission,
  Role,
} from "@/SecuritySystem/domain"
import { Logger } from "@/Shared/adapter"
import { CreateOrUpdateUser } from "@/SecuritySystem/applications"
import type { IJob } from "@/package/queue/domain"

export type BootstrapPermissionsRequest = {
  churchId: string
  roles: string[]
  userId?: string
  user?: {
    isSuperUser: boolean
    name: string
    email: string
  }
}

export class BootstrapPermissionsJob implements IJob {
  private readonly logger = Logger(BootstrapPermissionsJob.name)

  constructor(
    private readonly permissionRepository: IPermissionRepository,
    private readonly roleRepository: IRoleRepository,
    private readonly rolePermissionRepository: IRolePermissionRepository,
    private readonly userAssignmentRepository: IUserAssignmentRepository,
    private readonly userRepository: IUserRepository,
    private readonly passwordAdapter: IPasswordAdapter
  ) {}

  async handle(request: BootstrapPermissionsRequest): Promise<void> {
    this.logger.info(`Bootstrapping permissions for church ${request.churchId}`)

    await this.ensurePermissionsCatalog()
    await this.ensureBaseRoles(request.churchId)

    if (request.user) {
      request.userId = await this.createUser(request)
    }

    await this.assignRoleToCreator(
      request.churchId,
      request.userId!,
      request.roles
    )

    this.logger.info(
      `finished bootstrapping permissions for church ${request.churchId}`
    )
  }

  private async createUser(req: BootstrapPermissionsRequest): Promise<string> {
    const { churchId, user } = req

    return (
      await new CreateOrUpdateUser(
        this.userRepository,
        this.passwordAdapter
      ).execute({
        name: user!.name,
        email: user!.email,
        password: "ChangeMe123!",
        isActive: true,
        churchId: churchId,
        isSuperUser: user!.isSuperUser,
      })
    ).getUserId()
  }

  private async ensurePermissionsCatalog(): Promise<void> {
    this.logger.info(`Ensuring base permissions catalog`)

    for (const permissionDefinition of BASE_PERMISSIONS) {
      const existing = await this.permissionRepository.findByModuleAction(
        permissionDefinition.module,
        permissionDefinition.action
      )

      if (!existing) {
        const permission = Permission.create({
          permissionId: permissionDefinition.permissionId,
          module: permissionDefinition.module,
          action: permissionDefinition.action,
          description: permissionDefinition.description,
          isSystem: Boolean(permissionDefinition.isSystem),
        })

        try {
          await this.permissionRepository.upsert(permission)
        } catch (error) {
          if (!this.isDuplicateKeyError(error)) {
            throw error
          }
        }
      }
    }

    this.logger.info(`Finished ensuring base permissions catalog`)
  }

  private async ensureBaseRoles(churchId: string): Promise<void> {
    this.logger.info(`Ensuring base roles for church ${churchId}`)

    for (const roleDefinition of BASE_ROLES) {
      const existingRole = await this.roleRepository.findByRoleId(
        churchId,
        roleDefinition.roleId
      )

      if (!existingRole) {
        const role = Role.create(
          churchId,
          roleDefinition.name,
          roleDefinition.description,
          Boolean(roleDefinition.isSystem),
          roleDefinition.roleId
        )
        await this.roleRepository.upsert(role)
      }

      await this.rolePermissionRepository.replacePermissions(
        churchId,
        roleDefinition.roleId,
        roleDefinition.permissions
      )
    }

    this.logger.info(`Finished ensuring base roles for church ${churchId}`)
  }

  private async assignRoleToCreator(
    churchId: string,
    userId: string,
    roles: string[]
  ): Promise<void> {
    const assignment = await this.userAssignmentRepository.assignRoles(
      churchId,
      userId,
      roles
    )

    this.logger.info(
      `Assigned ADMIN role to user ${assignment.getUserId()} for church ${churchId}`
    )
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false
    }
    return "code" in error && (error as { code?: number }).code === 11000
  }
}
