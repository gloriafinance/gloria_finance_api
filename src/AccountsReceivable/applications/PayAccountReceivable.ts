import { Logger } from "@/Shared/adapter"
import {
  AccountReceivable,
  IAccountsReceivableRepository,
  Installments,
  InstallmentsStatus,
  PayAccountReceivableNotFound,
  PayAccountReceivableRequest,
} from "@/AccountsReceivable/domain"

export class PayAccountReceivable {
  private logger = Logger("PayAccountReceivable")

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository
  ) {}

  async execute(req: PayAccountReceivableRequest) {
    this.logger.info(`Start Pay Account Receivable`, req)

    const accountReceivable: AccountReceivable =
      await this.accountReceivableRepository.one(req.accountReceivableId)
    if (!accountReceivable) {
      this.logger.debug(`Account Receivable not found`)
      throw new PayAccountReceivableNotFound()
    }

    const amountPay = req.amount.getValue()

    for (const installmentId of req.installmentIds) {
      const installment = accountReceivable.getInstallment(installmentId)
      if (!installment) {
        this.logger.debug(`Installment ${installmentId} not found`)
        continue
      }
      this.payInstallment(installment, amountPay, req.financialTransactionId)
    }

    accountReceivable.updateAmount(req.amount)

    this.logger.info(
      `Account Receivable ${req.accountReceivableId} updated, amount pending ${accountReceivable.getAmountPending()} 
      status ${accountReceivable.getStatus()}`
    )

    await this.accountReceivableRepository.upsert(accountReceivable)

    this.logger.info(`Finish Pay Account Receivable`)
  }

  private payInstallment(
    installment: Installments,
    amountTransferred: number,
    financialTransactionId: string
  ) {
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

    installment.amountPaid = amountToCompare
    installment.amountPending = installment.amount - amountToCompare
    installment.financialTransactionId = financialTransactionId

    this.logger.info(
      `Installment ${installment.installmentId} updated`,
      installment
    )
  }
}
