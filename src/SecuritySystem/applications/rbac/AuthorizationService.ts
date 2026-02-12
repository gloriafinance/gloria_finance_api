import { Logger } from "@/Shared/adapter"
import type { ICacheService } from "@/Shared/domain"
import type {
  IPermissionRepository,
  IRolePermissionRepository,
  IUserAssignmentRepository,
} from "@/SecuritySystem/domain"

export type AuthorizationContext = {
  roles: string[]
  permissions: string[]
}

export class AuthorizationService {
  private static instance: AuthorizationService
  private readonly logger = Logger(AuthorizationService.name)

  private constructor(
    private readonly userAssignmentRepository: IUserAssignmentRepository,
    private readonly rolePermissionRepository: IRolePermissionRepository,
    private readonly permissionRepository: IPermissionRepository,
    private readonly cache: ICacheService
  ) {}

  static getInstance(
    userAssignmentRepository: IUserAssignmentRepository,
    rolePermissionRepository: IRolePermissionRepository,
    permissionRepository: IPermissionRepository,
    cache: ICacheService
  ): AuthorizationService {
    if (AuthorizationService.instance) {
      return AuthorizationService.instance
    }

    AuthorizationService.instance = new AuthorizationService(
      userAssignmentRepository!,
      rolePermissionRepository!,
      permissionRepository!,
      cache!
    )

    return AuthorizationService.instance
  }

  static configure(instance: AuthorizationService): void {
    AuthorizationService.instance = instance
  }

  async resolveAuthorization(
    churchId: string,
    userId: string
  ): Promise<AuthorizationContext> {
    const cacheKey = this.buildCacheKey(churchId, userId)

    const cached = await this.cache.get<AuthorizationContext>(cacheKey)

    if (cached) {
      this.logger.debug(
        `Authorization cache hit for church ${churchId} and user ${userId}`
      )
      return cached
    }

    const assignment = await this.userAssignmentRepository.findByUser(
      churchId,
      userId
    )

    const roles = assignment ? assignment.getRoles() : []

    if (!roles.length) {
      const emptyContext: AuthorizationContext = { roles: [], permissions: [] }
      await this.cache.set(cacheKey, emptyContext, 300)
      return emptyContext
    }

    const permissionIds =
      await this.rolePermissionRepository.findPermissionIdsByRoles(
        churchId,
        roles
      )

    const uniquePermissionIds = [...new Set(permissionIds)]

    const permissions =
      await this.permissionRepository.findByIds(uniquePermissionIds)

    const permissionCodes = permissions.map(
      (permission) => `${permission.getModule()}:${permission.getAction()}`
    )

    const context: AuthorizationContext = {
      roles,
      permissions: permissionCodes,
    }

    await this.cache.set(cacheKey, context, 300)

    this.logger.debug(
      `Authorization cache refreshed for church ${churchId} and user ${userId}`
    )

    return context
  }

  async invalidateUserCache(churchId: string, userId: string): Promise<void> {
    const cacheKey = this.buildCacheKey(churchId, userId)
    await this.cache.invalidate(cacheKey)
  }

  private buildCacheKey(churchId: string, userId: string): string {
    return `auth:${churchId}:${userId}:perms`
  }
}
