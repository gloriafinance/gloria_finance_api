import { Logger } from "../../Shared/adapter"
import { IPurchaseRepository } from "../domain/interfaces"
import { RecordPurchaseRequest } from "../domain/requests"
import {
  IAvailabilityAccountRepository,
  IFinancialConfigurationRepository,
} from "../../Financial/domain/interfaces"
import {
  DispatchFinancialRecord,
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
  FindAvailabilityAccountByAvailabilityAccountId,
  FindCostCenterByCostCenterId,
} from "../../Financial/applications"
import { Purchase } from "../domain"
import { IQueueService } from "../../Shared/domain"
import { TypeOperationMoney } from "../../Financial/domain"

export class RecordPurchase {
  private logger = Logger("RecordPurchase")

  constructor(
    private readonly purchaseRepository: IPurchaseRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
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
      request.items
    )

    this.logger.info(`RecordPurchase saving purchase`, purchase)
    await this.purchaseRepository.upsert(purchase)

    new DispatchUpdateCostCenterMaster(this.queueService).execute({
      churchId: request.churchId,
      costCenterId: request.costCenterId,
      amount: request.total,
    })

    new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
      operationType: TypeOperationMoney.MONEY_OUT,
      availabilityAccount: account,
      concept: request.description,
      amount: request.total,
    })

    new DispatchFinancialRecord(this.queueService).execute({
      financialConceptId: request.financialConceptId,
      churchId: request.churchId,
      amount: request.total,
      date: request.purchaseDate,
      availabilityAccountId: request.availabilityAccountId,
      voucher: request.invoice,
      description: request.description,
      costCenterId: request.costCenterId,
    })

    this.logger.info(`Purchase recorded`)
  }
}
