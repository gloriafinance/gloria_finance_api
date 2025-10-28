import { FilterFinanceRecordRequest } from "./FilterFinanceRecord.request"

export type FinanceRecordReportFormat = "csv" | "pdf"

export type FinanceRecordReportRequest = FilterFinanceRecordRequest & {
  format?: FinanceRecordReportFormat
}
