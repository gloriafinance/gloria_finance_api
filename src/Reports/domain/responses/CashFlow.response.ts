import type { CashFlowGroupBy } from "@/Reports/domain/requests/CashFlow.request.ts"

export interface CashFlowSummary {
  openingBalance: number
  entries: number
  exits: number
  net: number
  closingBalance: number
}

export interface CashFlowSeriesRow {
  period: Date
  entries: number
  exits: number
  net: number
  runningBalance: number
}

export interface CashFlowProjectionRow {
  period: Date
  projectedEntries: number
  projectedExits: number
  projectedNet: number
  projectedBalance: number
}

export interface CashFlowProjectionResult {
  status: "available" | "degraded" | "unavailable"
  historicalMonthCount: number
  buckets: CashFlowProjectionRow[]
}

export interface CashFlowBucketDetail {
  financialRecordId: string
  date: Date
  description?: string
  amount: number
  type: string
  flowType: "entry" | "exit"
  status: string
  accountId?: string
  accountName?: string
  accountType?: string
  categoryId?: string
  categoryName?: string
  categoryType?: string
  statementCategory?: string
  costCenterId?: string
  costCenterName?: string
  voucher?: string
}

export interface CashFlowBucketDetailsResult {
  startDate: Date
  endDate: Date
  groupBy: CashFlowGroupBy
  details: CashFlowBucketDetail[]
}

export interface CashFlowReportResult {
  summary: CashFlowSummary
  series: CashFlowSeriesRow[]
  projection: CashFlowProjectionResult
}

export interface CashFlowDirectResponse {
  reportName: string
  generatedAt: string
  filters: {
    startDate: string
    endDate: string
    groupBy: CashFlowGroupBy
    availabilityAccountIds?: string[]
    costCenterId?: string
    includeProjection: boolean
    projectionBuckets: number
  }
  summary: CashFlowSummary
  series: Array<{
    period: string
    entries: number
    exits: number
    net: number
    runningBalance: number
  }>
  projection: {
    label: string
    status: "available" | "degraded" | "unavailable"
    message?: string
    buckets: Array<{
      period: string
      projectedEntries: number
      projectedExits: number
      projectedNet: number
      projectedBalance: number
    }>
  }
  messages: string[]
}

export interface CashFlowBucketDetailsResponse {
  startDate: string
  endDate: string
  groupBy: CashFlowGroupBy
  details: Array<{
    financialRecordId: string
    date: string
    description?: string
    amount: number
    type: string
    flowType: "entry" | "exit"
    status: string
    accountId?: string
    accountName?: string
    accountType?: string
    categoryId?: string
    categoryName?: string
    categoryType?: string
    statementCategory?: string
    costCenterId?: string
    costCenterName?: string
    voucher?: string
  }>
}
