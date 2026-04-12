import { AccountType } from "@/FinanceConfig/domain"

export type Purchase = {
  purchaseId: string
  financialConceptId: string
  churchId: string
  purchaseDate: Date
  total: number
  tax: number
  description: string
  invoice: string
  availabilityAccount: {
    accountName: string
    accountType: AccountType
  }
  items: Array<{
    quantity: number
    price: number
    name: string
  }>
  costCenter: {
    costCenterId: string
    name: string
  }
  accountPayable: {
    accountPayableId: string
    amountPaid: number
    amountTotal: number
    installments: {
      installments: number
      installmentsPaid: number
    }
  }
  paymentType: "cash" | "credit"
}
