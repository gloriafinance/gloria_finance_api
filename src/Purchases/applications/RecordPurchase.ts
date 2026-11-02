import type { IPurchaseRepository } from "../domain/interfaces"
import type { RecordPurchaseRequest } from "../domain/requests"

import type { IQueueService } from "@/package/queue/domain"
import { SearchAvailabilityAccount } from "@/FinanceConfig/applications"
import type {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
  IFinancialConfigurationRepository,
} from "@/FinanceConfig/domain"
import { BasePurchaseRecord } from "@/Purchases/applications/BasePurchaseRecord.ts"

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
    const account = await new SearchAvailabilityAccount(
      this.availabilityAccountRepository
    ).execute({ availabilityAccountId: request.availabilityAccountId! })

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
