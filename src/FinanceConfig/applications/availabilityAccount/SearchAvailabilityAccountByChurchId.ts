import { IAvailabilityAccountRepository } from "../../../Financial/domain/interfaces"
import { AvailabilityAccount } from "../../../Financial/domain"
import { Logger } from "@/Shared/adapter"

export class SearchAvailabilityAccountByChurchId {
  private logger = Logger(SearchAvailabilityAccountByChurchId.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(churchId: string): Promise<AvailabilityAccount[]> {
    this.logger.info(`Search availability account for church ${churchId}`)
    return this.availabilityAccountRepository.list({
      churchId,
      active: true,
    })
  }
}
