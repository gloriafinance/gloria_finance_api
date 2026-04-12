import type { IPurchaseRepository } from "../domain/interfaces"
import type { RecordPurchaseRequest } from "../domain/requests"
import type {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
  IFinancialConfigurationRepository,
} from "@/Financial/domain/interfaces"
import type { IQueueService } from "@/package/queue/domain"
import { BasePurchaseRecord } from "@/Purchases/applications/BasePurchaseRecord.ts"
import { FindAvailabilityAccountByAvailabilityAccountId } from "@/FinanceConfig/applications"

export class RecordPurchase extends BasePurchaseRecord {
  constructor(
    purchaseRepository: IPurchaseRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    financialConfigurationRepository: IFinancialConfigurationRepository,
    financialConcept: IFinancialConceptRepository,
    queueService: IQueueService
  ) {
    super(
      purchaseRepository,
      financialConfigurationRepository,
      queueService,
      financialConcept
    )
  }

  async execute(request: RecordPurchaseRequest) {
    const account = await new FindAvailabilityAccountByAvailabilityAccountId(
      this.availabilityAccountRepository
    ).execute(request.availabilityAccountId!)

    const { purchase, costCenter } = await this.basicRecord({
      ...request,
      availabilityAccount: account,
      paymentType: "cash",
    })

    await this.generateFinancialRecord(
      request,
      account,
      costCenter,
      purchase.getPurchaseId()
    )
  }
}
