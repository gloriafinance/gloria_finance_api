import { IAvailabilityAccountRepository } from "../../domain/interfaces"
import { AvailabilityAccount } from "../../domain"

export class SearchAvailabilityAccountByChurchId {
  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(churchId: string): Promise<AvailabilityAccount[]> {
    return this.availabilityAccountRepository.list({
      churchId,
      active: true,
    })
  }
}
