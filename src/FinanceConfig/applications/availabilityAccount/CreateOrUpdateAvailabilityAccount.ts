import type { AvailabilityAccountRequest } from "@/FinanceConfig/domain"
import {
  AvailabilityAccount,
  type IAvailabilityAccountRepository,
} from "@/FinanceConfig/domain"
import { Logger } from "@/Shared/adapter"
import { FindAvailabilityAccountByAvailabilityAccountId } from "@/FinanceConfig/applications"

export class CreateOrUpdateAvailabilityAccount {
  private logger = Logger(CreateOrUpdateAvailabilityAccount.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(requestAvailabilityAccount: AvailabilityAccountRequest) {
    this.logger.info(
      `Creating or updating availability account`,
      requestAvailabilityAccount
    )

    if (!requestAvailabilityAccount.availabilityAccountId) {
      await this.registerAvailabilityAccount(requestAvailabilityAccount)
      this.logger.info(`Finished creating availability account`)
      return
    }

    const availabilityAccount =
      await new FindAvailabilityAccountByAvailabilityAccountId(
        this.availabilityAccountRepository
      ).execute(requestAvailabilityAccount.availabilityAccountId)

    availabilityAccount.setAccountName(requestAvailabilityAccount.accountName)

    requestAvailabilityAccount.active
      ? availabilityAccount.enable()
      : availabilityAccount.disable()

    await this.availabilityAccountRepository.upsert(availabilityAccount)
  }

  private async registerAvailabilityAccount(
    requestAvailabilityAccount: AvailabilityAccountRequest
  ): Promise<void> {
    const availabilityAccount = AvailabilityAccount.create(
      requestAvailabilityAccount.churchId,
      requestAvailabilityAccount.accountName,
      requestAvailabilityAccount.active,
      requestAvailabilityAccount.accountType,
      requestAvailabilityAccount.symbol,
      requestAvailabilityAccount.source
    )
    await this.availabilityAccountRepository.upsert(availabilityAccount)
  }
}
