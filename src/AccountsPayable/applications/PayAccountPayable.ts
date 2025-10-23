import { Logger } from "@/Shared/adapter"
import {
  AccountPayable,
  AccountPayableChurchMismatch,
  AccountPayableNotFound,
  IAccountPayableRepository,
  InstallmentNotFound,
  PayAccountPayableRequest,
} from "@/AccountsPayable/domain"
import { IAvailabilityAccountRepository } from "@/Financial/domain/interfaces"
import { IQueueService } from "@/Shared/domain"
import {
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
  FindAvailabilityAccountByAvailabilityAccountId,
} from "@/Financial/applications"
import { TypeOperationMoney } from "@/Financial/domain"
import { PayInstallment } from "@/Shared/applications"

export class PayAccountPayable {
  private logger = Logger(PayAccountPayable.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly accountPayableRepository: IAccountPayableRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(req: PayAccountPayableRequest) {
    this.logger.info(`Start Pay Account Payable`, req)

    const accountPayable: AccountPayable =
      await this.accountPayableRepository.one({
        accountPayableId: req.accountPayableId,
      })

    if (!accountPayable) {
      this.logger.debug(`Account Payable not found`)
      throw new AccountPayableNotFound()
    }

    if (accountPayable.getChurchId() !== req.churchId) {
      this.logger.debug(`Account Payable church mismatch`, {
        accountChurchId: accountPayable.getChurchId(),
        requestChurchId: req.churchId,
      })
      throw new AccountPayableChurchMismatch(
        accountPayable.getChurchId(),
        req.churchId
      )
    }

    const availabilityAccount =
      await new FindAvailabilityAccountByAvailabilityAccountId(
        this.availabilityAccountRepository
      ).execute(req.availabilityAccountId, req.churchId)

    let amountPay = req.amount.getValue()

    for (const installmentId of req.installmentIds) {
      const installment = accountPayable.getInstallment(installmentId)
      if (!installment) {
        this.logger.debug(`Installment ${installmentId} not found`)
        throw new InstallmentNotFound(installmentId)
      }
      amountPay = PayInstallment(
        installment,
        amountPay,
        req.financialTransactionId,
        this.logger
      )
    }

    accountPayable.updateAmount(req.amount)

    await this.accountPayableRepository.upsert(accountPayable)

    this.logger.info(
      `Account Payable ${req.accountPayableId} updated, amount pending ${accountPayable.getAmountPending()} 
      status ${accountPayable.getStatus()}`
    )

    new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
      operationType: TypeOperationMoney.MONEY_OUT,
      availabilityAccount: availabilityAccount,
      concept: req.concept.getDescription(),
      amount: req.amount.getValue(),
    })

    new DispatchUpdateCostCenterMaster(this.queueService).execute({
      churchId: accountPayable.getChurchId(),
      costCenterId: req.costCenterId,
      amount: req.amount.getValue(),
    })

    this.logger.info(`Finished Pay Account Payable`)
  }
}
