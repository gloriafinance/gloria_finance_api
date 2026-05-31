type loans = {
  accountReceivableId: string
  debtorName: string
  description: string
  amountTotal: number
  amountPaid: number
  amountPending: number
  status: string
  symbol: string
  createdAt: Date
}

export type AccountReceivableDashboardType = {
  total: number
  loans: loans[]
}
