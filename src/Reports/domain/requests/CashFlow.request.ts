export type CashFlowGroupBy = "day" | "week" | "month"

export interface CashFlowFilters {
  churchId: string
  startDate: Date
  endDate: Date
  groupBy: CashFlowGroupBy
  availabilityAccountId?: string
  financialConceptId?: string
  costCenterId?: string
  accountType?: string // lo mapearía a moneyLocation o accountType, según tu UX
}
