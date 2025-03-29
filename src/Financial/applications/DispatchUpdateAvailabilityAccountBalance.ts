import { Logger } from "../../Shared/adapter"
import { IQueueService, QueueName } from "../../Shared/domain"
import { AccountType, AvailabilityAccount, TypeOperationMoney } from "../domain"
import { TypeBankingOperation } from "../../MovementBank/domain"

export class DispatchUpdateAvailabilityAccountBalance {
  private logger = Logger("DispatchUpdateAvailabilityAccountBalance")

  constructor(private readonly queueService: IQueueService) {}

  execute(args: {
    availabilityAccount: AvailabilityAccount
    operationType: TypeOperationMoney
    concept: string
    amount: number
  }) {
    this.logger.info(`DispatchUpdateAvailabilityAccountBalance`, args)

    this.queueService.dispatch(QueueName.UpdateAvailabilityAccountBalance, {
      availabilityAccountId:
        args.availabilityAccount.getAvailabilityAccountId(),
      amount: args.amount,
      operationType: args.operationType,
    })

    if (args.availabilityAccount.getType() === AccountType.BANK) {
      this.queueService.dispatch(QueueName.MovementBankRecord, {
        amount: args.amount,
        bankingOperation: TypeOperationMoney.MONEY_OUT
          ? TypeBankingOperation.WITHDRAWAL
          : TypeBankingOperation.DEPOSIT,
        concept: args.concept,
        bankId: args.availabilityAccount.getSource().bankId,
      })
    }

    this.logger.info(`finished process`)
  }
}
