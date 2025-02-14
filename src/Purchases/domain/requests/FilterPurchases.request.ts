export type FilterPurchasesRequest = {
  startDate: Date
  endDate: Date
  churchId: string
  costCenter: string
  page: number
  perPage: number
}
