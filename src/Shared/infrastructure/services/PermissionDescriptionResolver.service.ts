import { PermissionMongoRepository } from "@/SecuritySystem/infrastructure"
import { type ICacheService } from "@/Shared/domain"
import { CacheProviderService } from "@/Shared/infrastructure/services/CacheProvider.service"

type CachedDescription = {
  description: string | null
}

export class PermissionDescriptionResolver {
  private static instance: PermissionDescriptionResolver
  private readonly CACHE_TTL_SECONDS = 60 * 5

  private constructor(
    private readonly permissionRepository: PermissionMongoRepository,
    private readonly cacheService: ICacheService
  ) {}

  static getInstance(): PermissionDescriptionResolver {
    if (!PermissionDescriptionResolver.instance) {
      PermissionDescriptionResolver.instance =
        new PermissionDescriptionResolver(
          PermissionMongoRepository.getInstance(),
          CacheProviderService.getInstance()
        )
    }

    return PermissionDescriptionResolver.instance
  }

  async resolveDescriptions(
    module: string,
    actions: string[]
  ): Promise<string[]> {
    const uniqueActions = Array.from(new Set(actions))
    const descriptions = await Promise.all(
      uniqueActions.map((action) => this.resolveDescription(module, action))
    )

    return descriptions.filter((description): description is string =>
      Boolean(description)
    )
  }

  private async resolveDescription(
    module: string,
    action: string
  ): Promise<string | undefined> {
    const cacheKey = this.cacheKey(module, action)
    const cached = await this.cacheService.get<CachedDescription>(cacheKey)

    if (cached) {
      return cached.description ?? undefined
    }

    const permission = await this.permissionRepository.findByModuleAction(
      module,
      action
    )
    const description = permission?.getDescription() ?? null

    this.cacheService.set(cacheKey, { description }, this.CACHE_TTL_SECONDS)

    return description ?? undefined
  }

  private cacheKey(module: string, action: string): string {
    return `permission_description:${module}:${action}`
  }
}
