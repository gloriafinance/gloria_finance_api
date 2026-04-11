import type { IPurchaseRepository } from "@/Purchases/domain/interfaces"
import {
  AccountType,
  AvailabilityAccount,
  CostCenter,
  type IFinancialConceptRepository,
  type IFinancialConfigurationRepository,
} from "@/FinanceConfig/domain"
import type { IQueueService } from "@/package/queue/domain"
import { DispatchCreateFinancialRecord } from "@/Financial/applications"
import type { RecordPurchaseRequest } from "@/Purchases/domain/requests"
import {
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"
import { Purchase } from "@/Purchases/domain"
import { FindCostCenterByCostCenterId } from "@/FinanceConfig/applications"
import { Logger } from "@/Shared/adapter"

export class BasePurchaseRecord {
  private logger = Logger(BasePurchaseRecord.name)

  constructor(
    private readonly purchaseRepository: IPurchaseRepository,
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
    protected queueService?: IQueueService,
    private readonly financialConcept?: IFinancialConceptRepository
  ) {}

  protected async basicRecord(
    request: Omit<
      RecordPurchaseRequest & {
        availabilityAccount?: AvailabilityAccount
        paymentType: "cash" | "credit"
        accountPayable?: {
          accountPayableId: string
          amountPaid: number
          amountTotal: number
          installments: {
            installments: number
            installmentsPaid: number
          }
        }
      },
      "availabilityAccountId" | "financialConceptId"
    >
  ) {
    this.logger.info(`RecordPurchase`, request)

    const costCenter = await new FindCostCenterByCostCenterId(
      this.financialConfigurationRepository
    ).execute(request.churchId, request.costCenterId)

    const purchase = Purchase.create(
      request.churchId,
      new Date(request.purchaseDate),
      Number(request.total),
      Number(request.tax),
      request.description,
      request.invoice,
      costCenter,
      request.items,
      request.createdBy,
      request.paymentType,
      request.availabilityAccount,
      request.accountPayable
    )

    this.logger.info(`RecordPurchase saving purchase`, purchase)
    await this.purchaseRepository.upsert(purchase)

    return { purchase, costCenter }
  }

  protected async generateFinancialRecord(
    request: RecordPurchaseRequest,
    account: AvailabilityAccount,
    costCenter: CostCenter,
    purchaseId: string
  ) {
    const concept = await this.financialConcept!.one({
      financialConceptId: request.financialConceptId,
    })

    await new DispatchCreateFinancialRecord(this.queueService!).execute({
      financialConcept: concept!,
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
      reference: {
        type: Purchase.name,
        entityId: purchaseId,
      },
    })
  }
}
