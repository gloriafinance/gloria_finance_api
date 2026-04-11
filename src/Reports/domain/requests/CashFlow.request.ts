export type CashFlowGroupBy = "day" | "week" | "month"
export type CashFlowExportFormat = "csv" | "pdf"

export interface CashFlowFilters {
  churchId: string
  startDate: Date
  endDate: Date
  groupBy: CashFlowGroupBy
  symbol?: string
  method?: string
  availabilityAccountId?: string | string[]
  costCenterId?: string
  includeProjection?: boolean
  projectionBuckets?: number
}

export type CashFlowBucketDetailsFilters = CashFlowFilters

export type CashFlowExportRequest = CashFlowFilters & {
  format: CashFlowExportFormat
  lang: string
}
