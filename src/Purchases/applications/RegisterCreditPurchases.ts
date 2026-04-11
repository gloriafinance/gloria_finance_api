import { BasePurchaseRecord } from "@/Purchases/applications/BasePurchaseRecord.ts"
import type { IPurchaseRepository } from "@/Purchases/domain/interfaces"
import { type IFinancialConfigurationRepository } from "@/FinanceConfig/domain"
import type { RecordPurchaseRequest } from "@/Purchases/domain/requests"
import { CreateAccountPayable } from "@/AccountsPayable/applications"
import {
  AccountPayableTaxStatus,
  TaxDocumentType,
} from "@/AccountsPayable/domain"

export class RegisterCreditPurchases extends BasePurchaseRecord {
  constructor(
    private readonly accountPayable: CreateAccountPayable,
    purchaseRepository: IPurchaseRepository,
    financialConfigurationRepository: IFinancialConfigurationRepository
  ) {
    super(purchaseRepository, financialConfigurationRepository)
  }

  async execute(
    request: Omit<
      RecordPurchaseRequest & {
        supplierId: string
        description: string
        symbol: string
        amountTotal?: number
        taxDocument: {
          type: TaxDocumentType
          number?: string
          date: Date
        }
        installments?: {
          amount: number
          dueDate: Date
        }[]
        taxes?: {
          taxType: string
          percentage: number
          amount?: number
          status?: AccountPayableTaxStatus
        }[]
      },
      "availabilityAccountId" | "financialConceptId"
    >
  ) {
    const accountPayable = await this.accountPayable.execute(request)

    await this.basicRecord({
      paymentType: "credit",
      ...request,
      accountPayable: {
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
