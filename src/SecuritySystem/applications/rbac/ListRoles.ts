import { IRoleRepository } from "@/SecuritySystem/domain"

export class ListRoles {
  constructor(private readonly roleRepository: IRoleRepository) {}

  async execute(churchId: string) {
    const roles = await this.roleRepository.list(churchId)
    return roles.map((role) => role.toPrimitives())
  }
}
