import { type IAvailabilityAccountRepository } from "@/FinanceConfig/domain"
import {
  AvailabilityAccount,
  AvailabilityAccountChurchMismatch,
  AvailabilityAccountNotFound,
} from "../../../Financial/domain"
import { Logger } from "@/Shared/adapter"
import type { MongoTransaction } from "@abejarano/ts-mongodb-criteria"

export class FindAvailabilityAccountByAvailabilityAccountId {
  private logger = Logger("FindAvailabilityAccountByAvailabilityAccountId")

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(
    availabilityAccountId: string,
    churchId?: string,
    transaction?: MongoTransaction
  ): Promise<AvailabilityAccount> {
    this.logger.info(
      `FindAvailabilityAccountByAvailabilityAccountId ${availabilityAccountId}`
    )
    const account = await this.availabilityAccountRepository.one(
      {
        availabilityAccountId,
      },
      transaction
    )

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
