import type {
  CashFlowBucketDetailsResponse,
  CashFlowBucketDetailsResult,
  CashFlowDirectResponse,
  CashFlowFilters,
  CashFlowReportResult,
} from "@/Reports/domain"

const toIsoString = (value: Date): string => new Date(value).toISOString()
const PROJECTION_LABEL = "Proyección base (estimación por media móvil 3M)"

const buildMessages = (
  report: CashFlowReportResult,
  filters: CashFlowFilters
): string[] => {
  const messages: string[] = []

  if (report.series.length === 0) {
    messages.push("No hay datos para los filtros seleccionados.")
  }

  if (filters.includeProjection && report.projection.status === "unavailable") {
    messages.push("Proyección indisponible por histórico insuficiente.")
  }

  if (filters.includeProjection && report.projection.status === "degraded") {
    messages.push("Proyección calculada con menos de 3 meses de histórico.")
  }

  return messages
}

export const mapCashFlowReportToResponse = (
  report: CashFlowReportResult,
  filters: CashFlowFilters,
  generatedAt: Date
): CashFlowDirectResponse => ({
  reportName: "Flujo de Caja (Directo)",
  generatedAt: toIsoString(generatedAt),
  filters: {
    startDate: toIsoString(filters.startDate),
    endDate: toIsoString(filters.endDate),
    groupBy: filters.groupBy,
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
    label: PROJECTION_LABEL,
    status: report.projection.status,
    message: !filters.includeProjection
      ? undefined
      : report.projection.status === "unavailable"
        ? "Proyección indisponible por histórico insuficiente."
        : report.projection.status === "degraded"
          ? "Proyección calculada con menos de 3 meses de histórico."
          : undefined,
    buckets: report.projection.buckets.map((row) => ({
      period: toIsoString(row.period),
      projectedEntries: row.projectedEntries,
      projectedExits: row.projectedExits,
      projectedNet: row.projectedNet,
      projectedBalance: row.projectedBalance,
    })),
  },
  messages: buildMessages(report, filters),
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
