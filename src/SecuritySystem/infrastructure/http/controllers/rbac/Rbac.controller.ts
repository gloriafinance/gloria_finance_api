import { Request, Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { HttpStatus } from "@/Shared/domain"
import {
  AssignPermissionsToRole,
  AssignRolesToUser,
  BootstrapPermissionsJob,
  CreateRole,
  GetRolePermissions,
  GetUserPermissions,
  ListPermissions,
  ListRoles,
} from "@/SecuritySystem/applications"
import {
  PasswordAdapter,
  PermissionMongoRepository,
  RoleMongoRepository,
  RolePermissionMongoRepository,
  UserAssignmentMongoRepository,
  UserMongoRepository,
} from "@/SecuritySystem/infrastructure"
import { AuthorizationService } from "@/SecuritySystem/applications/rbac/AuthorizationService"
import { UserPermissionsCache } from "@/Shared/infrastructure"

export class RbacController {
  private readonly authorizationService = AuthorizationService.getInstance(
    UserAssignmentMongoRepository.getInstance(),
    RolePermissionMongoRepository.getInstance(),
    PermissionMongoRepository.getInstance(),
    UserPermissionsCache.getInstance()
  )

  async bootstrap(req: Request, res: Response) {
    try {
      const auth = req.auth
      const targetUserId = req.body.userId ?? auth.userId

      await new BootstrapPermissionsJob(
        PermissionMongoRepository.getInstance(),
        RoleMongoRepository.getInstance(),
        RolePermissionMongoRepository.getInstance(),
        UserAssignmentMongoRepository.getInstance(),
        UserMongoRepository.getInstance(),
        new PasswordAdapter()
      ).handle({
        churchId: auth.churchId,
        userId: targetUserId,
      })

      await this.authorizationService.invalidateUserCache(
        auth.churchId,
        targetUserId
      )

      res.status(HttpStatus.CREATED).send({
        message: "RBAC bootstrap completed",
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  async createRole(req: Request, res: Response) {
    try {
      const auth = req.auth
      const role = await new CreateRole(
        RoleMongoRepository.getInstance()
      ).execute({
        churchId: auth.churchId,
        name: req.body.name,
        description: req.body.description,
      })

      res.status(HttpStatus.CREATED).send({
        message: "Role created",
        data: role.toPrimitives(),
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  async assignPermissionsToRole(req: Request, res: Response) {
    try {
      const auth = req.auth
      const roleId = req.params.id
      const permissionIds: string[] = req.body.permissionIds ?? []

      const role = await new AssignPermissionsToRole(
        RoleMongoRepository.getInstance(),
        PermissionMongoRepository.getInstance(),
        RolePermissionMongoRepository.getInstance()
      ).execute({
        churchId: auth.churchId,
        roleId,
        permissionIds,
      })

      await this.invalidateCacheForRole(auth.churchId, roleId)

      res.status(HttpStatus.OK).send({
        message: "Permissions updated",
        data: role.toPrimitives(),
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  async getRolePermissions(req: Request, res: Response) {
    try {
      const auth = req.auth
      const roleId = req.params.id

      const permissions = await new GetRolePermissions(
        RoleMongoRepository.getInstance(),
        RolePermissionMongoRepository.getInstance(),
        PermissionMongoRepository.getInstance()
      ).execute({
        churchId: auth.churchId,
        roleId,
      })

      res.status(HttpStatus.OK).send({ data: permissions })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  async assignRolesToUser(req: Request, res: Response) {
    try {
      const auth = req.auth
      const userId = req.params.id
      const roles: string[] = req.body.roles ?? []

      const assignment = await new AssignRolesToUser(
        RoleMongoRepository.getInstance(),
        UserAssignmentMongoRepository.getInstance(),
        this.authorizationService
      ).execute({
        churchId: auth.churchId,
        userId,
        roles,
      })

      res.status(HttpStatus.OK).send({
        message: "Roles assigned",
        data: assignment.toPrimitives(),
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  async getUserPermissions(req: Request, res: Response) {
    try {
      const auth = req.auth
      const userId = req.params.id

      const permissions = await new GetUserPermissions(
        this.authorizationService
      ).execute({
        churchId: auth.churchId,
        userId,
      })

      res.status(HttpStatus.OK).send({
        data: permissions,
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  async listRoles(req: Request, res: Response) {
    try {
      const auth = req.auth
      const roles = await new ListRoles(
        RoleMongoRepository.getInstance()
      ).execute(auth.churchId)

      res.status(HttpStatus.OK).send({ data: roles })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  async listPermissions(_req: Request, res: Response) {
    try {
      const permissions = await new ListPermissions(
        PermissionMongoRepository.getInstance()
      ).execute()

      res.status(HttpStatus.OK).send({ data: permissions })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  private async invalidateCacheForRole(
    churchId: string,
    roleId: string
  ): Promise<void> {
    const userIds =
      await UserAssignmentMongoRepository.getInstance().findUserIdsByRole(
        churchId,
        roleId
      )

    await Promise.all(
      userIds.map((userId) =>
        this.authorizationService.invalidateUserCache(churchId, userId)
      )
    )
  }
}
