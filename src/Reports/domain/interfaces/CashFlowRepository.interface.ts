import type {
  CashFlowBucketDetail,
  CashFlowBucketDetailsFilters,
  CashFlowFilters,
  CashFlowReportResult,
} from "@/Reports/domain"

export interface ICashFlowRepository {
  getCashFlowDirectReport(
    filters: CashFlowFilters
  ): Promise<CashFlowReportResult>

  getCashFlowBucketDetails(
    filters: CashFlowBucketDetailsFilters
  ): Promise<CashFlowBucketDetail[]>
}
