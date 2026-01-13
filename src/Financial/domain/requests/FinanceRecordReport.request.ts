import { FilterFinanceRecordRequest } from "@/Financial/domain"

export type FinanceRecordReportFormat = "csv" | "pdf"

export type FinanceRecordReportRequest = FilterFinanceRecordRequest & {
  format?: FinanceRecordReportFormat
}
