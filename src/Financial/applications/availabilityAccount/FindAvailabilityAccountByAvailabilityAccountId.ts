import { IAvailabilityAccountRepository } from "../../domain/interfaces"
import {
  AvailabilityAccount,
  AvailabilityAccountChurchMismatch,
  AvailabilityAccountNotFound,
} from "../../domain"
import { Logger } from "@/Shared/adapter"

export class FindAvailabilityAccountByAvailabilityAccountId {
  private logger = Logger("FindAvailabilityAccountByAvailabilityAccountId")

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(
    availabilityAccountId: string,
    churchId?: string
  ): Promise<AvailabilityAccount> {
    this.logger.info(
      `FindAvailabilityAccountByAvailabilityAccountId ${availabilityAccountId}`
    )
    const account = await this.availabilityAccountRepository.one({
      availabilityAccountId,
    })

    if (!account) {
      this.logger.info(`Availability account not found`)
      throw new AvailabilityAccountNotFound()
    }

    if (churchId && account.getChurchId() !== churchId) {
      this.logger.info(
        `Availability account ${availabilityAccountId} belongs to church ${account.getChurchId()} but ${churchId} was provided`
      )
      throw new AvailabilityAccountChurchMismatch(
        account.getChurchId(),
        churchId
      )
    }

    return account
  }
}
