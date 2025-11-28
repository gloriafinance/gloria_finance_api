import { Logger } from "@/Shared/adapter"
import {
  AccountReceivable,
  IAccountsReceivableRepository,
  InstallmentNotFound,
  PayAccountReceivableNotFound,
  PayAccountReceivableRequest,
} from "@/AccountsReceivable/domain"
import { IQueueService } from "@/Shared/domain"
import { DispatchCreateFinancialRecord } from "@/Financial/applications"
import {
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"
import {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { PayInstallment } from "@/Shared/applications"
import { DateBR, UnitOfWork } from "@/Shared/helpers"
import { FindAvailabilityAccountByAvailabilityAccountId } from "@/FinanceConfig/applications"

export class PayAccountReceivable {
  private logger = Logger(PayAccountReceivable.name)

  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
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

    const availabilityAccount =
      await new FindAvailabilityAccountByAvailabilityAccountId(
        this.availabilityAccountRepository
      ).execute(req.availabilityAccountId, accountReceivable.getChurchId())

    const unitOfWork = new UnitOfWork()
    const accountReceivableSnapshot = AccountReceivable.fromPrimitives({
      ...accountReceivable.toPrimitives(),
      id: accountReceivable.getId(),
    })

    unitOfWork.registerRollbackActions(async () => {
      await this.accountReceivableRepository.upsert(accountReceivableSnapshot)
    })

    try {
      let amountPay = req.amount.getValue()

      for (const installmentId of req.installmentIds) {
        const installment = accountReceivable.getInstallment(installmentId)
        if (!installment) {
          this.logger.debug(`Installment ${installmentId} not found`)
          throw new InstallmentNotFound(installmentId)
        }

        amountPay = PayInstallment(installment, amountPay, this.logger)
      }

      accountReceivable.updateAmount(req.amount)

      this.logger.info(
        `Account Receivable ${req.accountReceivableId} updated, amount pending ${accountReceivable.getAmountPending()} 
      status ${accountReceivable.getStatus()}`
      )

      await this.accountReceivableRepository.upsert(accountReceivable)

      this.logger.info(`Account Receivable ${req.accountReceivableId} updated`)

      new DispatchCreateFinancialRecord(this.queueService).execute({
        file: req.file,
        churchId: accountReceivable.getChurchId(),
        date: DateBR(),
        createdBy: req.createdBy,
        financialRecordType: FinancialRecordType.INCOME,
        source: FinancialRecordSource.AUTO,
        status: FinancialRecordStatus.CLEARED,
        amount: req.amount.getValue(),
        availabilityAccount: {
          ...availabilityAccount.toPrimitives(),
          id: availabilityAccount.getId(),
        },
        financialConcept: accountReceivable.getFinancialConcept(),
        description: `Conta a Receber criada: ${accountReceivable.getDescription()}`,
        reference: {
          entityId: `${accountReceivable.getAccountReceivableId()} installments ${req.installmentIds.join(",")}`,
          type: "AccountReceivable",
        },
      })

      await unitOfWork.commit()

      this.logger.info(`Finished Pay Account Receivable`)
    } catch (e) {
      await unitOfWork.rollback()
      throw e
    }
  }
}
