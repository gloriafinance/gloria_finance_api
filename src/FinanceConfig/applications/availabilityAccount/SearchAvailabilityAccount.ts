import { type IAvailabilityAccountRepository } from "@/FinanceConfig/domain"
import {
  AvailabilityAccount,
  AvailabilityAccountNotFound,
} from "../../../Financial/domain"
import type { DatabaseTransactionContext } from "@/Shared/adapter"
import { Logger } from "@/Shared/adapter"

export class SearchAvailabilityAccount {
  private logger = Logger("SearchAvailabilityAccount")

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(
    filter: object,
    transaction?: DatabaseTransactionContext
  ): Promise<AvailabilityAccount> {
    this.logger.info(
      `FindAvailabilityAccountByAvailabilityAccountId ${JSON.stringify(filter)}`
    )
    // const filter: any = {
    //   availabilityAccountId,
    // }
    //
    // if (churchId) {
    //   filter.churchId = churchId
    // }

    const account = await this.availabilityAccountRepository.one(filter, {
      transaction,
    })

    if (!account) {
      this.logger.info(`Availability account not found`)
      throw new AvailabilityAccountNotFound()
    }

    return account
  }
}
