import { Minister } from "../../domain"
import type { IMinisterRepository, MinisterRequest } from "../../domain"

export class RegisterOrUpdateMinister {
  constructor(private readonly ministerRepository: IMinisterRepository) {}

  async execute(request: MinisterRequest): Promise<void> {
    let minister: Minister = await this.ministerRepository.findByDni(
      request.dni
    )

    if (!minister) {
      minister = await this.createMinister(request)
    }

    minister.setPhone(request.phone)
    minister.setEmail(request.email)
    minister.setName(request.name)

    await this.ministerRepository.upsert(minister)
  }

  private async createMinister(request: MinisterRequest): Promise<Minister> {
    return Minister.create(
      request.name,
      request.email,
      request.phone,
      request.dni,
      request.ministerType
    )
  }
}
