import type { IJob } from "@/Shared/domain"
import type {
  IAvailabilityAccountMasterRepository,
  IAvailabilityAccountRepository,
} from "../../domain/interfaces"
import { AvailabilityAccount, TypeOperationMoney } from "../../domain"

import { UpdateAvailabilityAccountMaster } from "@/Financial/applications/UpdateAvailabilityAccountMaster"
import { Logger } from "@/Shared/adapter"

export type UpdateAvailabilityAccountBalanceRequest = {
  availabilityAccount: any
  amount: number
  operationType: TypeOperationMoney
  period?: { year: number; month: number }
}

export class UpdateAvailabilityAccountBalanceJob implements IJob {
  private logger = Logger("UpdateAvailabilityAccountBalance")

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly availabilityAccountMasterRepository: IAvailabilityAccountMasterRepository
  ) {}

  async handle(args: UpdateAvailabilityAccountBalanceRequest): Promise<void> {
    this.logger.info(`UpdateAvailabilityAccountBalance`, {
      ...args,
      jobName: UpdateAvailabilityAccountBalanceJob.name,
    })

    const account: AvailabilityAccount =
      (await this.availabilityAccountRepository.one({
        availabilityAccountId: args.availabilityAccount.availabilityAccountId,
      }))!

    if (args.operationType === TypeOperationMoney.MONEY_IN) {
      account.increaseBalance(Number(args.amount))
    } else {
      account.decreaseBalance(Number(args.amount))
    }

    await this.availabilityAccountRepository.upsert(account)

    this.logger.info(`UpdateAvailabilityAccountBalance finish`, {
      jobName: UpdateAvailabilityAccountBalanceJob.name,
      availabilityAccountId: account.getAvailabilityAccountId(),
      churchId: account.getChurchId(),
      amount: args.amount,
      operationType: args.operationType,
    })

    await new UpdateAvailabilityAccountMaster(
      this.availabilityAccountMasterRepository
    ).execute(account, Number(args.amount), args.operationType, args.period)
  }
}
