import {
  type IAvailabilityAccountRepository,
  type UpdateAvailabilityAccountRequest,
} from "@/FinanceConfig/domain"
import { Logger } from "@/Shared/adapter"
import { FindAvailabilityAccountByAvailabilityAccountId } from "./FindAvailabilityAccountByAvailabilityAccountId"

export class UpdateAvailabilityAccount {
  private logger = Logger(UpdateAvailabilityAccount.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async execute(request: UpdateAvailabilityAccountRequest): Promise<void> {
    this.logger.info(`Updating availability account`, request)

    const availabilityAccount =
      await new FindAvailabilityAccountByAvailabilityAccountId(
        this.availabilityAccountRepository
      ).execute(request.availabilityAccountId, request.churchId)

    availabilityAccount.setAccountName(request.accountName)

    request.active
      ? availabilityAccount.enable()
      : availabilityAccount.disable()

    await this.availabilityAccountRepository.upsert(availabilityAccount)
    this.logger.info(`Finished updating availability account`)
  }
}
