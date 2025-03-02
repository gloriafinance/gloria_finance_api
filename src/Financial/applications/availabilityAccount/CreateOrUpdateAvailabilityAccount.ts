import { IAvailabilityAccountRepository } from "../../domain/interfaces"
import { AvailabilityAccount, AvailabilityAccountRequest } from "../../domain"

export class CreateOrUpdateAvailabilityAccount {
  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(requestAvailabilityAccount: AvailabilityAccountRequest) {
    if (!requestAvailabilityAccount.availabilityAccountId) {
      await this.registerAvailabilityAccount(requestAvailabilityAccount)
      return
    }

    const availabilityAccount: AvailabilityAccount =
      await this.availabilityAccountRepository.findAvailabilityAccountByAvailabilityAccountId(
        requestAvailabilityAccount.availabilityAccountId
      )

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
      requestAvailabilityAccount.source
    )
    await this.availabilityAccountRepository.upsert(availabilityAccount)
  }
}
