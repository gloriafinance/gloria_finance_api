export interface CashFlowSeriesRow {
  period: Date
  entries: number
  exits: number
  net: number
  runningBalance: number
}

export interface CashFlowReportResult {
  openingBalance: number
  entries: number
  exits: number
  net: number
  closingBalance: number
  series: CashFlowSeriesRow[]
}

export interface CashFlowDirectResponse {
  summary: {
    openingBalance: number
    entries: number
    exits: number
    net: number
    closingBalance: number
  }
  series: Array<{
    period: string
    entries: number
    exits: number
    net: number
    runningBalance: number
  }>
  projection?: Array<{
    period: string
    projectedEntries: number
    projectedExits: number
    projectedNet: number
    projectedBalance: number
  }>
}
