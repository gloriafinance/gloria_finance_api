import { IRoleRepository, Role } from "@/SecuritySystem/domain"
import { ActionNotAllowed } from "@/SecuritySystem/domain/exceptions/ActionNotAllowed"

export type CreateRoleRequest = {
  churchId: string
  name: string
  description: string
}

export class CreateRole {
  constructor(private readonly roleRepository: IRoleRepository) {}

  async execute(request: CreateRoleRequest): Promise<Role> {
    const existingRole = await this.roleRepository.findByName(
      request.churchId,
      request.name
    )

    if (existingRole) {
      throw new ActionNotAllowed()
      //`Role with name ${request.name} already exists in church ${request.churchId}`
    }

    const role = Role.create(
      request.churchId,
      request.name,
      request.description,
      false
    )

    await this.roleRepository.upsert(role)

    return role
  }
}
