import { Logger } from "@/Shared/adapter"
import {
  AccountPayable,
  AccountPayableChurchMismatch,
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
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
  FindAvailabilityAccountByAvailabilityAccountId,
  FindCostCenterByCostCenterId,
  RegisterFinancialRecord,
} from "@/Financial/applications"
import { FinancialConcept, TypeOperationMoney } from "@/Financial/domain"
import { PayInstallment } from "@/Shared/applications"
import { UnitOfWork } from "@/Shared/helpers"

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

    const accountPayableSnapshot = AccountPayable.fromPrimitives(
      accountPayable.toPrimitives()
    )

    try {
      const { concept, financialRecordId, voucher } =
        await this.makeFinanceRecord(req, unitOfWork)

      req.concept = concept
      req.financialTransactionId = financialRecordId
      req.voucher = voucher

      let amountPay = req.amount.getValue()
      const financialTransactionId = financialRecordId

      for (const installmentId of req.installmentIds) {
        const installment = accountPayable.getInstallment(installmentId)
        if (!installment) {
          this.logger.debug(`Installment ${installmentId} not found`)
          throw new InstallmentNotFound(installmentId)
        }
        amountPay = PayInstallment(
          installment,
          amountPay,
          financialTransactionId,
          this.logger
        )
      }

      accountPayable.updateAmount(req.amount)

      await this.accountPayableRepository.upsert(accountPayable)
      unitOfWork.register(async () => {
        await this.accountPayableRepository.upsert(accountPayableSnapshot)
      })

      this.logger.info(
        `Account Payable ${req.accountPayableId} updated, amount pending ${accountPayable.getAmountPending()} 
        status ${accountPayable.getStatus()}`
      )

      await unitOfWork.commit()

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
    } catch (error) {
      await unitOfWork.rollback()
      throw error
    }
  }

  private async makeFinanceRecord(
    req: PayAccountPayableRequest,
    unitOfWork: UnitOfWork
  ): Promise<{
    concept: FinancialConcept
    financialRecordId: string
    voucher?: string
  }> {
    let voucher: string | undefined

    if (req.file) {
      voucher = await this.storageService.uploadFile(req.file)
      unitOfWork.register(async () => {
        if (voucher) {
          await this.storageService.deleteFile(voucher)
        }
      })
    }

    const concept = await this.financialConceptRepository.one({
      name: "Contas a Pagar",
      churchId: req.churchId,
    })

    const costCenter = await new FindCostCenterByCostCenterId(
      this.financialConfigurationRepository
    ).execute(req.churchId, req.costCenterId)

    const financialRecord = await new RegisterFinancialRecord(
      this.financialYearRepository,
      this.financialRecordRepository,
      this.financialConceptRepository,
      this.availabilityAccountRepository
    ).handle(
      {
        churchId: req.churchId,
        availabilityAccountId: req.availabilityAccountId,
        voucher,
        amount: req.amount.getValue(),
        date: new Date(),
        description: `pagamento de conta a pagar: parcela: ${req.installmentIds.join(",")}`,
      },
      concept,
      costCenter
    )

    unitOfWork.register(async () => {
      await this.financialRecordRepository.deleteByFinancialRecordId(
        financialRecord.getFinancialRecordId()
      )
    })

    return {
      concept,
      financialRecordId: financialRecord.getFinancialRecordId(),
      voucher,
    }
  }
}
