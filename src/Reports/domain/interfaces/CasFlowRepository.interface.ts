import type { CashFlowFilters, CashFlowReportResult } from "@/Reports/domain"

export interface ICasFlowRepository {
  getCashFlowDirectReport(
    filters: CashFlowFilters
  ): Promise<CashFlowReportResult>
}
