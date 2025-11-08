import { IQueue } from "@/Shared/domain"
import {
  IAvailabilityAccountMasterRepository,
  IAvailabilityAccountRepository,
} from "../../domain/interfaces"
import {
  AvailabilityAccount,
  TypeOperationMoney,
  UpdateAvailabilityAccountBalanceRequest,
} from "../../domain"

import { UpdateAvailabilityAccountMaster } from "../availabilityAccount/UpdateAvailabilityAccountMaster"
import { Logger } from "@/Shared/adapter"

export class UpdateAvailabilityAccountBalanceJob implements IQueue {
  private logger = Logger("UpdateAvailabilityAccountBalance")

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly availabilityAccountMasterRepository: IAvailabilityAccountMasterRepository
  ) {}

  async handle(args: UpdateAvailabilityAccountBalanceRequest): Promise<void> {
    this.logger.info(`UpdateAvailabilityAccountBalance`, args)
    const account: AvailabilityAccount =
      await this.availabilityAccountRepository.one({
        availabilityAccountId: args.availabilityAccountId,
      })

    if (args.operationType === TypeOperationMoney.MONEY_IN) {
      account.increaseBalance(Number(args.amount))
    } else {
      account.decreaseBalance(Number(args.amount))
    }

    await this.availabilityAccountRepository.upsert(account)

    this.logger.info(`UpdateAvailabilityAccountBalance finish`, account)

    await new UpdateAvailabilityAccountMaster(
      this.availabilityAccountMasterRepository
    ).execute(account, Number(args.amount), args.operationType, args.period)
  }
}
