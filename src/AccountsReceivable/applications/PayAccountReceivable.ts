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
import { DateBR } from "@/Shared/helpers"
import type { IQueueService } from "@/package/queue/domain"
import { MongoTransaction } from "@abejarano/ts-mongodb-criteria"
import { FindAvailabilityAccountByAvailabilityAccountId } from "@/FinanceConfig/applications"
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

    try {
      const eventData = await MongoTransaction.run(async (transaction) => {
        const accountReceivable: AccountReceivable | null =
          await this.accountReceivableRepository.one(
            {
              accountReceivableId: req.accountReceivableId,
            },
            transaction
          )

        if (!accountReceivable) {
          this.logger.debug(`Account Receivable not found`)
          throw new PayAccountReceivableNotFound()
        }

        const availabilityAccount =
          await new FindAvailabilityAccountByAvailabilityAccountId(
            this.availabilityAccountRepository
          ).execute(
            req.availabilityAccountId,
            accountReceivable.getChurchId(),
            transaction
          )
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

        await this.accountReceivableRepository.upsert(
          accountReceivable,
          transaction
        )

        this.logger.info(
          `Account Receivable ${req.accountReceivableId} updated`
        )

        const concept = await this.financialConcept(accountReceivable)

        return { availabilityAccount, accountReceivable, concept }
      })

      let voucher = undefined
      if (req.file) {
        voucher = await StorageProviderService.getInstance().uploadFile(
          req.file
        )
      }

      await new DispatchCreateFinancialRecord(this.queueService).execute({
        voucher,
        churchId: eventData.accountReceivable.getChurchId(),
        date: DateBR(),
        createdBy: req.createdBy,
        financialRecordType: FinancialRecordType.INCOME,
        source: FinancialRecordSource.AUTO,
        status: FinancialRecordStatus.CLEARED,
        amount: req.amount.getValue(),
        availabilityAccount: {
          ...eventData.availabilityAccount.toPrimitives(),
          id: eventData.availabilityAccount.getId(),
        },
        financialConcept: eventData.concept,
        description: `${eventData.concept.getDescription()}: ${eventData.accountReceivable.getDescription()}`,
        reference: {
          entityId: `${eventData.accountReceivable.getAccountReceivableId()} installments ${req.installmentIds.join(",")}`,
          type: "AccountReceivable",
        },
      })

      this.logger.info(`Finished Pay Account Receivable`)
    } catch (e: any) {
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
