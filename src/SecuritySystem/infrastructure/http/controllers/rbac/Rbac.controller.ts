import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  Use,
} from "bun-platform-kit"
import type { ServerResponse } from "bun-platform-kit"

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
import {
  Can,
  CacheProviderService,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"

@Controller("/api/v1/rbac")
export class RbacController {
  private readonly authorizationService = AuthorizationService.getInstance(
    UserAssignmentMongoRepository.getInstance(),
    RolePermissionMongoRepository.getInstance(),
    PermissionMongoRepository.getInstance(),
    CacheProviderService.getInstance()
  )

  @Post("/permissions/bootstrap")
  @Use([PermissionMiddleware, Can("rbac", "bootstrap")])
  async bootstrap(
    @Body() body: { userId?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const auth = req.auth
      const targetUserId = body.userId ?? auth.userId

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
        roles: ["ADMIN"],
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

  @Post("/roles")
  @Use([PermissionMiddleware, Can("rbac", "manage_roles")])
  async createRole(
    @Body() body: { name: string; description: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const auth = req.auth
      const role = await new CreateRole(
        RoleMongoRepository.getInstance()
      ).execute({
        churchId: auth.churchId,
        name: body.name,
        description: body.description,
      })

      res.status(HttpStatus.CREATED).send({
        message: "Role created",
        data: role.toPrimitives(),
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/roles/:id/permissions")
  @Use([PermissionMiddleware, Can("rbac", "manage_roles")])
  async assignPermissionsToRole(
    @Param("id") roleId: string,
    @Body() body: { permissionIds?: string[] },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const auth = req.auth
      const permissionIds: string[] = body.permissionIds ?? []

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

  @Get("/roles/:id/permissions")
  @Use([PermissionMiddleware, Can("rbac", "read")])
  async getRolePermissions(
    @Param("id") roleId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const auth = req.auth

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

  @Post("/users/:id/assignments")
  @Use([PermissionMiddleware, Can("rbac", "assign_roles")])
  async assignRolesToUser(
    @Param("id") userId: string,
    @Body() body: { roles?: string[] },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const auth = req.auth
      const roles: string[] = body.roles ?? []

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

  @Get("/users/:id/permissions")
  @Use([PermissionMiddleware, Can("rbac", "read")])
  async getUserPermissions(
    @Param("id") userId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const auth = req.auth

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

  @Get("/roles")
  @Use([PermissionMiddleware, Can("rbac", "read")])
  async listRoles(
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
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

  @Get("/permissions")
  @Use([PermissionMiddleware, Can("rbac", "read")])
  async listPermissions(@Res() res: ServerResponse) {
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
