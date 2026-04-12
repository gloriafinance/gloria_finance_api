export type RecordPurchaseRequest = {
  costCenterId: string
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
  createdBy: string
}
