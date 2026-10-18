import {
  type IAvailabilityAccountRepository,
  type UpdateAvailabilityAccountRequest,
} from "@/FinanceConfig/domain"
import { Logger } from "@/Shared/adapter"
import { SearchAvailabilityAccount } from "@/FinanceConfig/applications"

export class UpdateAvailabilityAccount {
  private logger = Logger(UpdateAvailabilityAccount.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(request: UpdateAvailabilityAccountRequest): Promise<void> {
    this.logger.info(`Updating availability account`, request)

    const availabilityAccount = await new SearchAvailabilityAccount(
      this.availabilityAccountRepository
    ).execute({
      availabilityAccountId: request.availabilityAccountId,
      churchId: request.churchId,
    })

    availabilityAccount.setAccountName(request.accountName)

    request.active
      ? availabilityAccount.enable()
      : availabilityAccount.disable()

    await this.availabilityAccountRepository.upsert(availabilityAccount)
    this.logger.info(`Finished updating availability account`)
  }
}
