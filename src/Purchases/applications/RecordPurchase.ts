import { Logger } from "../../Shared/adapter"
import { IPurchaseRepository } from "../domain/interfaces"
import { RecordPurchaseRequest } from "../domain/requests"
import {
  IAvailabilityAccountRepository,
  IFinancialConfigurationRepository,
} from "../../Financial/domain/interfaces"
import {
  FindAvailabilityAccountByAvailabilityAccountId,
  FindCostCenterByCostCenterId,
} from "../../Financial/applications"
import { Purchase } from "../domain"
import { IQueueService, QueueName } from "../../Shared/domain"
import { TypeOperationMoney } from "../../Financial/domain"
import { TypeBankingOperation } from "../../MovementBank/domain"

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

    await this.purchaseRepository.upsert(purchase)

    this.queueService.dispatch(QueueName.UpdateCostCenterMaster, {
      churchId: request.churchId,
      costCenterId: request.costCenterId,
      amount: request.total,
    })

    this.queueService.dispatch(QueueName.UpdateAvailabilityAccountBalance, {
      operationType: TypeOperationMoney.MONEY_OUT,
      availabilityAccountId: request.availabilityAccountId,
      amount: request.total,
    })

    this.queueService.dispatch(QueueName.RegisterFinancialRecord, {
      financialConceptId: request.financialConceptId,
      churchId: request.churchId,
      amount: request.total,
      date: request.purchaseDate,
      availabilityAccountId: request.availabilityAccountId,
      voucher: request.invoice,
      description: request.description,
      bankId: request.bankId,
      costCenterId: request.costCenterId,
    })

    this.queueService.dispatch(QueueName.MovementBankRecord, {
      bankId: request.bankId,
      amount: request.total,
      bankingOperation: TypeBankingOperation.WITHDRAWAL,
      concept: request.description,
    })

    this.logger.info(`Purchase recorded`)
  }
}
