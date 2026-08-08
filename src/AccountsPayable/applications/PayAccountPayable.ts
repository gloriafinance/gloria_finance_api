import { Logger } from "@/Shared/adapter"
import {
  AccountPayable,
  AccountPayableNotFound,
  type IAccountPayableRepository,
  InstallmentNotFound,
  type PayAccountPayableRequest,
} from "@/AccountsPayable/domain"
import type {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
  IFinancialConfigurationRepository,
} from "@/Financial/domain/interfaces"
import { AmountValue } from "@/Shared/domain"
import { PayInstallment } from "@/Shared/applications"
import {
  AvailabilityAccount,
  CostCenter,
  FinancialConcept,
  FinancialConceptNotFound,
} from "@/FinanceConfig/domain"
import { type IQueueService, QueueName } from "@/package/queue/domain"
import { MongoTransaction } from "@abejarano/ts-mongodb-criteria"
import { DispatchCreateFinancialRecord } from "@/Financial/applications"
import { StorageProviderService } from "@/Shared/infrastructure"
import { DateBR } from "@/Shared/helpers"
import {
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"
import { FindAvailabilityAccountByAvailabilityAccountId } from "@/FinanceConfig/applications"

export class PayAccountPayable {
  private logger = Logger(PayAccountPayable.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly accountPayableRepository: IAccountPayableRepository,
    private readonly queueService: IQueueService,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository
  ) {}

  async execute(req: PayAccountPayableRequest & { amount: AmountValue }) {
    this.logger.info(`Start Pay Account Payable`, req)

    try {
      const eventData = await MongoTransaction.run(async (transaction) => {
        const accountPayable = await this.accountPayableRepository.one({
          accountPayableId: req.accountPayableId,
        })

        if (!accountPayable) {
          this.logger.debug(`Account Payable not found`)
          throw new AccountPayableNotFound()
        }

        const concept = await this.financialConceptRepository.one(
          {
            tag: "Accounts to Pay",
            churchId: accountPayable.getChurchId(),
          },
          transaction
        )

        if (!concept) {
          this.logger.debug(`Financial Concept 'Contas a Pagar' not found`)
          throw new FinancialConceptNotFound()
        }

        const availabilityAccount =
          await new FindAvailabilityAccountByAvailabilityAccountId(
            this.availabilityAccountRepository
          ).execute(
            req.availabilityAccountId,
            accountPayable.getChurchId(),
            transaction
          )
        let amountPay = req.amount.getValue()

        for (const installmentId of req.installmentIds) {
          const installment = accountPayable.getInstallment(installmentId)
          if (!installment) {
            this.logger.debug(`Installment ${installmentId} not found`)
            throw new InstallmentNotFound(installmentId)
          }
          amountPay = PayInstallment(installment, amountPay, this.logger)
        }

        accountPayable.updateAmount(req.amount)
        await this.accountPayableRepository.upsert(accountPayable, transaction)

        this.logger.info(
          `Account Payable ${req.accountPayableId} updated, amount pending ${accountPayable.getAmountPending()} 
        status ${accountPayable.getStatus()}`
        )

        return { availabilityAccount, accountPayable, concept }
      })

      await this.events(
        req,
        eventData.availabilityAccount,
        eventData.accountPayable,
        eventData.concept
      )

      this.logger.info(`Finished Pay Account Payable`)
    } catch (error: any) {
      this.logger.error(`Error paying Account Payable`, error)
      throw error
    }
  }

  private async events(
    req: PayAccountPayableRequest & { amount: AmountValue },
    availabilityAccount: AvailabilityAccount,
    accountPayable: AccountPayable,
    concept: FinancialConcept
  ) {
    let costCenter: CostCenter | undefined
    if (req.costCenterId) {
      costCenter =
        await this.financialConfigurationRepository.findCostCenterByCostCenterId(
          req.costCenterId,
          accountPayable.getChurchId()
        )
    }

    let voucher = undefined
    if (req.file) {
      voucher = await StorageProviderService.getInstance().uploadFile(req.file)
    }

    await new DispatchCreateFinancialRecord(this.queueService).execute({
      churchId: accountPayable.getChurchId(),
      costCenter: { ...costCenter?.toPrimitives() },
      voucher,
      date: DateBR(),
      createdBy: req.createdBy,
      availabilityAccount,
      financialRecordType: FinancialRecordType.OUTGO,
      source: FinancialRecordSource.AUTO,
      status: FinancialRecordStatus.CLEARED,
      amount: req.amount.getValue(),
      financialConcept: concept,
      description: `pagamento de conta a pagar (${accountPayable.getDescription()}): parcela: ${req.installmentIds.join(",")}`,
      reference: {
        entityId: `${accountPayable.getAccountPayableId()} installments ${req.installmentIds.join(",")}`,
        type: "AccountPayable",
      },
    })

    this.queueService.dispatch(QueueName.PurchasesEvent, {
      event: "update",
      source: "accountPayablePaid",
      data: {
        accountPayableId: accountPayable.getAccountPayableId(),
        amountPaid: accountPayable.getAmountPaid(),
        amountTotal: accountPayable.getAmountTotal(),
        installments: {
          installments: accountPayable.getNumberInstallments(),
          installmentsPaid: accountPayable.getAmountFeesPaid(),
        },
      },
    })
  }
}
