import {
  AvailabilityAccount,
  type AvailabilityAccountRequest,
  type IAvailabilityAccountRepository,
} from "@/FinanceConfig/domain"
import { Logger } from "@/Shared/adapter"

type CreateAvailabilityAccountRequest = Pick<
  AvailabilityAccountRequest,
  "churchId" | "accountName" | "active" | "accountType" | "symbol" | "source"
>

export class CreateAvailabilityAccount {
  private logger = Logger(CreateAvailabilityAccount.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(
    requestAvailabilityAccount: CreateAvailabilityAccountRequest
  ): Promise<void> {
    this.logger.info(
      `Creating availability account`,
      requestAvailabilityAccount
    )

    const availabilityAccount = AvailabilityAccount.create(
      requestAvailabilityAccount.churchId,
      requestAvailabilityAccount.accountName,
      requestAvailabilityAccount.active,
      requestAvailabilityAccount.accountType,
      requestAvailabilityAccount.symbol,
      requestAvailabilityAccount.source
    )

    await this.availabilityAccountRepository.upsert(availabilityAccount)
    this.logger.info(`Finished creating availability account`)
  }
}
