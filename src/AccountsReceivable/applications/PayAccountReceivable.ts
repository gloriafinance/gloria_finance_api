import { Logger } from "@/Shared/adapter"
import {
  AccountReceivable,
  IAccountsReceivableRepository,
  PayAccountReceivableNotFound,
  PayAccountReceivableRequest,
} from "@/AccountsReceivable/domain"
import { IQueueService } from "@/Shared/domain"
import { DispatchUpdateAvailabilityAccountBalance } from "@/Financial/applications"
import { TypeOperationMoney } from "@/Financial/domain"
import { IAvailabilityAccountRepository } from "@/Financial/domain/interfaces"
import { PayInstallment } from "@/Shared/applications"

export class PayAccountReceivable {
  private logger = Logger(PayAccountReceivable.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly accountReceivableRepository: IAccountsReceivableRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(req: PayAccountReceivableRequest) {
    this.logger.info(`Start Pay Account Receivable`, req)

    const accountReceivable: AccountReceivable =
      await this.accountReceivableRepository.one({
        accountReceivableId: req.accountReceivableId,
      })

    if (!accountReceivable) {
      this.logger.debug(`Account Receivable not found`)
      throw new PayAccountReceivableNotFound()
    }

    let amountPay = req.amount.getValue()

    for (const installmentId of req.installmentIds) {
      const installment = accountReceivable.getInstallment(installmentId)
      if (!installment) {
        this.logger.debug(`Installment ${installmentId} not found`)
        continue
      }
      amountPay = PayInstallment(
        installment,
        amountPay,
        req.financialTransactionId,
        this.logger
      )
    }

    accountReceivable.updateAmount(req.amount)

    this.logger.info(
      `Account Receivable ${req.accountReceivableId} updated, amount pending ${accountReceivable.getAmountPending()} 
      status ${accountReceivable.getStatus()}`
    )

    await this.accountReceivableRepository.upsert(accountReceivable)

    this.logger.info(`Account Receivable ${req.accountReceivableId} updated`)

    new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
      operationType: TypeOperationMoney.MONEY_IN,
      availabilityAccount: await this.availabilityAccountRepository.one({
        availabilityAccountId: req.availabilityAccountId,
      }),
      concept: req.concept.getDescription(),
      amount: req.amount.getValue(),
    })

    this.logger.info(`Finished Pay Account Receivable`)
  }
}
