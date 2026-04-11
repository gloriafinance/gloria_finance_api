import type {
  CashFlowBucketDetailsResponse,
  CashFlowBucketDetailsResult,
  CashFlowDirectResponse,
  CashFlowFilters,
  CashFlowReportResult,
} from "@/Reports/domain"
import { getCashFlowReportCatalog } from "@/Reports/applications/localization/CashFlowReport.localization.ts"

const toIsoString = (value: Date): string => new Date(value).toISOString()

const buildMessages = (
  report: CashFlowReportResult,
  filters: CashFlowFilters,
  lang?: string
): string[] => {
  const messagesCatalog = getCashFlowReportCatalog(lang).messages
  const messages: string[] = []

  if (report.series.length === 0) {
    messages.push(messagesCatalog.noData)
  }

  if (filters.includeProjection && report.projection.status === "unavailable") {
    messages.push(messagesCatalog.projectionUnavailable)
  }

  if (filters.includeProjection && report.projection.status === "degraded") {
    messages.push(messagesCatalog.projectionDegraded)
  }

  return messages
}

export const mapCashFlowReportToResponse = (
  report: CashFlowReportResult,
  filters: CashFlowFilters,
  generatedAt: Date,
  lang?: string
): CashFlowDirectResponse => ({
  reportName: getCashFlowReportCatalog(lang).reportName,
  generatedAt: toIsoString(generatedAt),
  filters: {
    startDate: toIsoString(filters.startDate),
    endDate: toIsoString(filters.endDate),
    groupBy: filters.groupBy,
    symbol: filters.symbol,
    method: filters.method,
    availabilityAccountIds: Array.isArray(filters.availabilityAccountId)
      ? filters.availabilityAccountId
      : filters.availabilityAccountId
        ? [filters.availabilityAccountId]
        : undefined,
    costCenterId: filters.costCenterId,
    includeProjection: filters.includeProjection === true,
    projectionBuckets:
      filters.projectionBuckets ?? report.projection.buckets.length,
  },
  summary: report.summary,
  series: report.series.map((row) => ({
    period: toIsoString(row.period),
    entries: row.entries,
    exits: row.exits,
    net: row.net,
    runningBalance: row.runningBalance,
  })),
  projection: {
    label: getCashFlowReportCatalog(lang).projectionLabel,
    status: report.projection.status,
    message: !filters.includeProjection
      ? undefined
      : report.projection.status === "unavailable"
        ? getCashFlowReportCatalog(lang).messages.projectionUnavailable
        : report.projection.status === "degraded"
          ? getCashFlowReportCatalog(lang).messages.projectionDegraded
          : undefined,
    buckets: report.projection.buckets.map((row) => ({
      period: toIsoString(row.period),
      projectedEntries: row.projectedEntries,
      projectedExits: row.projectedExits,
      projectedNet: row.projectedNet,
      projectedBalance: row.projectedBalance,
    })),
  },
  messages: buildMessages(report, filters, lang),
})

export const mapCashFlowBucketDetailsToResponse = (
  result: CashFlowBucketDetailsResult
): CashFlowBucketDetailsResponse => ({
  startDate: toIsoString(result.startDate),
  endDate: toIsoString(result.endDate),
  groupBy: result.groupBy,
  details: result.details.map((detail) => ({
    ...detail,
    date: toIsoString(detail.date),
  })),
})
