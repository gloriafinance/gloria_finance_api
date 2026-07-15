import type {
  AvailabilityAccountRequest,
  UpdateAvailabilityAccountRequest,
} from "@/FinanceConfig/domain"
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

  async execute(
    requestAvailabilityAccount:
      | AvailabilityAccountRequest
      | UpdateAvailabilityAccountRequest
  ): Promise<void> {
    this.logger.info(
      `Creating or updating availability account`,
      requestAvailabilityAccount
    )

    const availabilityAccountId =
      requestAvailabilityAccount.availabilityAccountId

    if (!availabilityAccountId) {
      await this.registerAvailabilityAccount({
        churchId: requestAvailabilityAccount.churchId,
        accountName: requestAvailabilityAccount.accountName,
        active: requestAvailabilityAccount.active,
        accountType: requestAvailabilityAccount.accountType,
        symbol: requestAvailabilityAccount.symbol,
        source: requestAvailabilityAccount.source,
      })
      this.logger.info(`Finished creating availability account`)
      return
    }

    const availabilityAccount =
      await new FindAvailabilityAccountByAvailabilityAccountId(
        this.availabilityAccountRepository
      ).execute(availabilityAccountId, requestAvailabilityAccount.churchId)

    availabilityAccount.setAccountName(requestAvailabilityAccount.accountName)

    requestAvailabilityAccount.active
      ? availabilityAccount.enable()
      : availabilityAccount.disable()

    await this.availabilityAccountRepository.upsert(availabilityAccount)
  }

  private async registerAvailabilityAccount(
    requestAvailabilityAccount: Pick<
      AvailabilityAccountRequest,
      | "churchId"
      | "accountName"
      | "active"
      | "accountType"
      | "symbol"
      | "source"
    >
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
