import { IAvailabilityAccountRepository } from "../../domain/interfaces"
import { AvailabilityAccountNotFound } from "../../domain"
import { Logger } from "../../../Shared/adapter"

export class FindAvailabilityAccountByAvailabilityAccountId {
  private logger = Logger("FindAvailabilityAccountByAvailabilityAccountId")

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(availabilityAccountId: string) {
    this.logger.info(
      `FindAvailabilityAccountByAvailabilityAccountId ${availabilityAccountId}`
    )
    const account =
      await this.availabilityAccountRepository.findAvailabilityAccountByAvailabilityAccountId(
        availabilityAccountId
      )

    if (!account) {
      this.logger.info(`Availability account not found`)
      throw new AvailabilityAccountNotFound()
    }

    return account
  }
}
