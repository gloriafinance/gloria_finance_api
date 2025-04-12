import { Logger } from "@/Shared/adapter"
import {
  AccountReceivable,
  IAccountsReceivableRepository,
  Installments,
  InstallmentsStatus,
  PayAccountReceivableNotFound,
  PayAccountReceivableRequest,
} from "@/AccountsReceivable/domain"
import { IQueueService } from "@/Shared/domain"
import { DispatchUpdateAvailabilityAccountBalance } from "@/Financial/applications"
import { TypeOperationMoney } from "@/Financial/domain"
import { IAvailabilityAccountRepository } from "@/Financial/domain/interfaces"

export class PayAccountReceivable {
  private logger = Logger("PayAccountReceivable")

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly accountReceivableRepository: IAccountsReceivableRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(req: PayAccountReceivableRequest) {
    this.logger.info(`Start Pay Account Receivable`, req)

    const accountReceivable: AccountReceivable =
      await this.accountReceivableRepository.one(req.accountReceivableId)
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
      amountPay = this.payInstallment(
        installment,
        amountPay,
        req.financialTransactionId
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
      operationType: TypeOperationMoney.MONEY_OUT,
      availabilityAccount:
        await this.availabilityAccountRepository.findAvailabilityAccountByAvailabilityAccountId(
          req.availabilityAccountId
        ),
      concept: req.concept.getDescription(),
      amount: req.amount.getValue(),
    })

    this.logger.info(`Finish Pay Account Receivable`)
  }

  private payInstallment(
    installment: Installments,
    amountTransferred: number,
    financialTransactionId: string
  ): number {
    if (installment.status === InstallmentsStatus.PAID) {
      this.logger.debug(`Installment ${installment.installmentId} already paid`)
      return
    }

    this.logger.info(
      `Installment ${installment.installmentId} is was ${installment.status.toLowerCase()} payment`
    )

    const amountToCompare =
      installment.status === InstallmentsStatus.PENDING
        ? installment.amount
        : installment.amountPending

    installment.status =
      amountTransferred >= amountToCompare
        ? InstallmentsStatus.PAID
        : InstallmentsStatus.PARTIAL

    const amountPending = installment.amountPending ?? installment.amount

    const newAmountPending = amountPending - amountTransferred

    if (newAmountPending < 0) {
      installment.amountPending = 0
      installment.amountPaid = installment.amount
    } else {
      installment.amountPending = newAmountPending
      installment.amountPaid =
        amountTransferred + (installment.amountPending || 0)
    }

    installment.financialTransactionId = financialTransactionId

    this.logger.info(
      `Installment ${installment.installmentId} updated`,
      installment
    )

    return amountTransferred - amountPending
  }
}
