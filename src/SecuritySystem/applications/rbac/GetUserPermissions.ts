import { AuthorizationService } from "@/SecuritySystem/applications/rbac/AuthorizationService"

export type GetUserPermissionsRequest = {
  churchId: string
  userId: string
}

export class GetUserPermissions {
  constructor(private readonly authorizationService: AuthorizationService) {}

  async execute(request: GetUserPermissionsRequest) {
    return this.authorizationService.resolveAuthorization(
      request.churchId,
      request.userId
    )
  }
}
