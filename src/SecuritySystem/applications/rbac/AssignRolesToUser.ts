import { AuthorizationService } from "@/SecuritySystem/applications/rbac/AuthorizationService"
import {
  IRoleRepository,
  IUserAssignmentRepository,
  UserAssignment,
} from "@/SecuritySystem/domain"
import { ActionNotAllowed } from "@/SecuritySystem/domain/exceptions/ActionNotAllowed"

export type AssignRolesToUserRequest = {
  churchId: string
  userId: string
  roles: string[]
}

export class AssignRolesToUser {
  constructor(
    private readonly roleRepository: IRoleRepository,
    private readonly userAssignmentRepository: IUserAssignmentRepository,
    private readonly authorizationService: AuthorizationService
  ) {}

  async execute(request: AssignRolesToUserRequest): Promise<UserAssignment> {
    const uniqueRoles = [...new Set(request.roles)]
    const roles = await this.roleRepository.list(request.churchId)
    const availableRoleIds = roles.map((role) => role.getRoleId())

    const invalidRoles = uniqueRoles.filter(
      (roleId) => !availableRoleIds.includes(roleId)
    )

    if (invalidRoles.length) {
      throw new ActionNotAllowed()
      //`Roles not found for church ${request.churchId}: ${invalidRoles.join(", ")}`
    }

    const assignment = await this.userAssignmentRepository.assignRoles(
      request.churchId,
      request.userId,
      uniqueRoles
    )

    await this.authorizationService.invalidateUserCache(
      request.churchId,
      request.userId
    )

    return assignment
  }
}
