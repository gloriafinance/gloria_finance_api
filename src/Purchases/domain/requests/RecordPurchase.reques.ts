export type RecordPurchaseRequest = {
  costCenterId: string
  bankId: string
  financialConceptId: string
  churchId: string
  purchaseDate: Date
  total: number
  tax: number
  description: string
  invoice: string
  items: Array<{
    quantity: number
    price: number
    name: string
  }>
  availabilityAccountId: string
  file?: any
  createdBy: string
}
