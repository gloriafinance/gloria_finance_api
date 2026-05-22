type accounts = {
  installmentAmount: number
  total: number
  nextPaymentDate: Date
  status: string
  paymentSituation: "OVERDUE" | "UP_TO_DATE"
  accountPayableId: string
}
export type AccountPayablesDashboardType = {
  total: number
  accounts: accounts[]
}
