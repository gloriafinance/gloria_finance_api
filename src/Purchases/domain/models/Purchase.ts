import { AccountType } from "../../../Financial/domain"

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
}
