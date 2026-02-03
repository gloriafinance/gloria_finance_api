import { Logger } from "@/Shared/adapter"
import { type IQueueService, QueueName } from "@/package/queue/domain"
import {
  AccountType,
  AvailabilityAccount,
  TypeOperationMoney,
} from "../../domain"
import type { UpdateAvailabilityAccountBalanceRequest } from "@/Financial/applications"

enum BankingOperationType {
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
  INTEREST = "INTEREST",
}

export class DispatchUpdateAvailabilityAccountBalance {
  private logger = Logger(DispatchUpdateAvailabilityAccountBalance.name)

  constructor(private readonly queueService: IQueueService) {}

  execute(params: {
    availabilityAccount: AvailabilityAccount
    operationType: TypeOperationMoney
    concept: string
    amount: number
    createdAt?: Date
  }) {
    this.logger.info(`DispatchUpdateAvailabilityAccountBalance`, params)

    const { createdAt, concept, operationType, availabilityAccount, amount } =
      params

    this.queueService.dispatch<UpdateAvailabilityAccountBalanceRequest>(
      QueueName.UpdateAvailabilityAccountBalanceJob,
      {
        availabilityAccount: {
          ...availabilityAccount.toPrimitives(),
          id: availabilityAccount.getId(),
        },
        amount: amount,
        operationType: operationType,
      }
    )

    if (availabilityAccount.getType() === AccountType.BANK) {
      this.queueService.dispatch(QueueName.MovementBankRecordJob, {
        amount: amount,
        bankingOperation:
          operationType === TypeOperationMoney.MONEY_OUT
            ? BankingOperationType.WITHDRAWAL
            : BankingOperationType.DEPOSIT,
        concept: concept,
        bankId: availabilityAccount.getSource().bankId,
        createdAt: createdAt === undefined ? new Date() : new Date(createdAt),
      })
    }

    this.logger.info(`finished process`)
  }
}
