import { Logger } from "@/Shared/adapter"
import {
  AccountPayable,
  AccountPayableNotFound,
  IAccountPayableRepository,
  InstallmentNotFound,
  PayAccountPayableRequest,
} from "@/AccountsPayable/domain"
import {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
  IFinancialConfigurationRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { IQueueService, IStorageService } from "@/Shared/domain"
import {
  DispatchCreateFinancialRecord,
  FindAvailabilityAccountByAvailabilityAccountId,
} from "@/Financial/applications"
import { PayInstallment } from "@/Shared/applications"
import { DateBR, UnitOfWork } from "@/Shared/helpers"
import {
  CostCenter,
  FinancialConceptNotFound,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"

export class PayAccountPayable {
  private logger = Logger(PayAccountPayable.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly accountPayableRepository: IAccountPayableRepository,
    private readonly queueService: IQueueService,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly storageService: IStorageService
  ) {}

  async execute(req: PayAccountPayableRequest) {
    this.logger.info(`Start Pay Account Payable`, req)

    const unitOfWork = new UnitOfWork()

    const accountPayable: AccountPayable =
      await this.accountPayableRepository.one({
        accountPayableId: req.accountPayableId,
      })

    if (!accountPayable) {
      this.logger.debug(`Account Payable not found`)
      throw new AccountPayableNotFound()
    }

    const accountPayableSnapshot = AccountPayable.fromPrimitives({
      ...accountPayable.toPrimitives(),
      id: accountPayable.getId(),
    })
    unitOfWork.registerRollbackActions(async () => {
      await this.accountPayableRepository.upsert(accountPayableSnapshot)
    })

    const availabilityAccount =
      await new FindAvailabilityAccountByAvailabilityAccountId(
        this.availabilityAccountRepository
      ).execute(req.availabilityAccountId, accountPayable.getChurchId())

    //TODO multi language support
    const concept = await this.financialConceptRepository.one({
      name: "Contas a Pagar",
      churchId: accountPayable.getChurchId(),
    })

    if (!concept) {
      this.logger.debug(`Financial Concept 'Contas a Pagar' not found`)
      throw new FinancialConceptNotFound("Contas a Pagar")
    }

    let costCenter: CostCenter
    if (req.costCenterId) {
      costCenter =
        await this.financialConfigurationRepository.findCostCenterByCostCenterId(
          req.costCenterId,
          accountPayable.getChurchId()
        )
    }

    unitOfWork.execPostCommit(async () => {
      new DispatchCreateFinancialRecord(this.queueService).execute({
        churchId: accountPayable.getChurchId(),
        costCenter: { ...costCenter.toPrimitives() },
        file: req.file,
        date: DateBR(),
        createdBy: req.createdBy,
        availabilityAccount,
        financialRecordType: FinancialRecordType.OUTGO,
        source: FinancialRecordSource.AUTO,
        status: FinancialRecordStatus.CLEARED,
        amount: req.amount.getValue(),
        financialConcept: concept,
        description: `pagamento de conta a pagar: parcela: ${req.installmentIds.join(",")}`,
        reference: {
          entityId: `${accountPayable.getAccountPayableId()} installments ${req.installmentIds.join(",")}`,
          type: "AccountPayable",
        },
      })
    })

    try {
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
      await this.accountPayableRepository.upsert(accountPayable)

      this.logger.info(
        `Account Payable ${req.accountPayableId} updated, amount pending ${accountPayable.getAmountPending()} 
        status ${accountPayable.getStatus()}`
      )

      await unitOfWork.commit()

      this.logger.info(`Finished Pay Account Payable`)
    } catch (error) {
      this.logger.error(`Error paying Account Payable`, error)
      await unitOfWork.rollback()
    }
  }
}
