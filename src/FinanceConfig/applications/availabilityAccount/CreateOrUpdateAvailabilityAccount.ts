import { IAvailabilityAccountRepository } from "../../../Financial/domain/interfaces"
import { AvailabilityAccount } from "../../../Financial/domain"
import type { AvailabilityAccountRequest } from "../../../Financial/domain"
import { Logger } from "@/Shared/adapter"

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

    const availabilityAccount: AvailabilityAccount =
      await this.availabilityAccountRepository.one({
        availabilityAccountId: requestAvailabilityAccount.availabilityAccountId,
      })

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
