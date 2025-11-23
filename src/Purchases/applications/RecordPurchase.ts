import { Logger } from "@/Shared/adapter"
import { IPurchaseRepository } from "../domain/interfaces"
import { RecordPurchaseRequest } from "../domain/requests"
import {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
  IFinancialConfigurationRepository,
} from "@/Financial/domain/interfaces"
import {
  DispatchCreateFinancialRecord,
  FindAvailabilityAccountByAvailabilityAccountId,
  FindCostCenterByCostCenterId,
} from "@/Financial/applications"
import { Purchase } from "../domain"
import { IQueueService } from "@/Shared/domain"
import {
  AccountType,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"

export class RecordPurchase {
  private logger = Logger(RecordPurchase.name)

  constructor(
    private readonly purchaseRepository: IPurchaseRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
    private readonly financialConcept: IFinancialConceptRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(request: RecordPurchaseRequest) {
    this.logger.info(`RecordPurchase`, request)

    const account = await new FindAvailabilityAccountByAvailabilityAccountId(
      this.availabilityAccountRepository
    ).execute(request.availabilityAccountId)

    const costCenter = await new FindCostCenterByCostCenterId(
      this.financialConfigurationRepository
    ).execute(request.churchId, request.costCenterId)

    const purchase = Purchase.create(
      request.financialConceptId,
      request.churchId,
      request.purchaseDate,
      request.total,
      request.tax,
      request.description,
      request.invoice,
      account,
      costCenter,
      request.items,
      request.createdBy
    )

    this.logger.info(`RecordPurchase saving purchase`, purchase)
    await this.purchaseRepository.upsert(purchase)

    const concept = await this.financialConcept.one({
      financialConceptId: request.financialConceptId,
    })

    new DispatchCreateFinancialRecord(this.queueService).execute({
      financialConcept: concept,
      churchId: request.churchId,
      amount: request.total,
      date: request.purchaseDate,
      availabilityAccount: account,
      costCenter: { ...costCenter.toPrimitives() },
      voucher: request.invoice,
      description: request.description,
      createdBy: request.createdBy,
      financialRecordType: FinancialRecordType.OUTGO,
      source: FinancialRecordSource.AUTO,
      status:
        account.getType() !== AccountType.CASH
          ? FinancialRecordStatus.CLEARED
          : FinancialRecordStatus.RECONCILED,
    })

    this.logger.info(`Purchase recorded`)
  }
}
