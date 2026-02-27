import { Logger } from "@/Shared/adapter"
import {
  AccountReceivable,
  AccountReceivableType,
  type IAccountsReceivableRepository,
  InstallmentNotFound,
  PayAccountReceivableNotFound,
  type PayAccountReceivableRequest,
} from "@/AccountsReceivable/domain"
import { DispatchCreateFinancialRecord } from "@/Financial/applications"
import {
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"
import {
  type IAvailabilityAccountRepository,
  type IFinancialConceptRepository,
} from "@/Financial/domain/interfaces"
import { PayInstallment } from "@/Shared/applications"
import { DateBR, UnitOfWork } from "@/Shared/helpers"
import { FindAvailabilityAccountByAvailabilityAccountId } from "@/FinanceConfig/applications"
import type { IQueueService } from "@/package/queue/domain"
import { StorageProviderService } from "@/Shared/infrastructure"

export class PayAccountReceivable {
  private logger = Logger(PayAccountReceivable.name)

  constructor(
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly accountReceivableRepository: IAccountsReceivableRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(req: PayAccountReceivableRequest) {
    this.logger.info(`Start Pay Account Receivable`, req)

    const accountReceivable: AccountReceivable | null =
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

      let voucher = undefined
      if (req.file) {
        voucher = await StorageProviderService.getInstance().uploadFile(
          req.file
        )
      }

      const financialConcept = await this.financialConcept(accountReceivable)

      await new DispatchCreateFinancialRecord(this.queueService).execute({
        voucher,
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
        financialConcept,
        description: `${financialConcept.getDescription()}: ${accountReceivable.getDescription()}`,
        reference: {
          entityId: `${accountReceivable.getAccountReceivableId()} installments ${req.installmentIds.join(",")}`,
          type: "AccountReceivable",
        },
      })

      await unitOfWork.commit()

      this.logger.info(`Finished Pay Account Receivable`)
    } catch (e: any) {
      await unitOfWork.rollback()
      this.logger.error(`Error pay account receivable`, e)
      throw e
    }
  }

  private async financialConcept(accountReceivable: AccountReceivable) {
    if (accountReceivable.getType() === AccountReceivableType.LOAN) {
      return (await this.financialConceptRepository.one({
        tag: "COLLECT_LOANDS",
        churchId: accountReceivable.getChurchId(),
      }))!
    }

    return accountReceivable.getFinancialConcept()
  }
}
