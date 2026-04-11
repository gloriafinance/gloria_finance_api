import type {
  AvailabilityAccount,
  IAvailabilityAccountRepository,
} from "@/FinanceConfig/domain"
import type { IChurchRepository } from "@/Church/domain/interfaces/ChurchRepository.interface.ts"
import type {
  CashFlowExportRequest,
  ICashFlowRepository,
} from "@/Reports/domain"
import { getCashFlowReportCatalog } from "@/Reports/applications/localization/CashFlowReport.localization.ts"
import { Logger } from "@/Shared/adapter"
import { GeneratePDFAdapter } from "@/Shared/adapter/GeneratePDF.adapter"
import type { IXLSExportAdapter, ReportFile } from "@/Shared/domain"

export class GenerateCashFlowReportExport {
  private logger = Logger(GenerateCashFlowReportExport.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly cashFlowRepository: ICashFlowRepository,
    private readonly pdfGenerator: GeneratePDFAdapter,
    private readonly excelExportAdapter: IXLSExportAdapter
  ) {}

  async execute(request: CashFlowExportRequest): Promise<ReportFile> {
    this.logger.info("Generating cash flow export", request)

    const report =
      await this.cashFlowRepository.getCashFlowDirectReport(request)

    if (request.format === "pdf") {
      return await this.buildPdfFile(request, report)
    }

    return await this.buildCsvFile(report)
  }

  private async buildCsvFile(
    report: Awaited<ReturnType<ICashFlowRepository["getCashFlowDirectReport"]>>
  ): Promise<ReportFile> {
    const rows = [
      ...report.series.map((row) => [
        "REALIZED",
        row.period.toISOString(),
        row.entries,
        row.exits,
        row.net,
        row.runningBalance,
        "available",
      ]),
      ...report.projection.buckets.map((row) => [
        "PROJECTED",
        row.period.toISOString(),
        row.projectedEntries,
        row.projectedExits,
        row.projectedNet,
        row.projectedBalance,
        report.projection.status,
      ]),
    ]

    return await this.excelExportAdapter.export(
      rows,
      ["Section", "Period", "Entries", "Exits", "Net", "Balance", "Status"],
      "cash-flow"
    )
  }

  private async buildPdfFile(
    request: CashFlowExportRequest,
    report: Awaited<ReturnType<ICashFlowRepository["getCashFlowDirectReport"]>>
  ): Promise<ReportFile> {
    const church = await this.churchRepository.findById(request.churchId)
    const locale = getCashFlowReportCatalog(request.lang)
    const filters = await this.buildPdfFilters(request)
    const timestamp = Date.now()

    return {
      filename: `cash-flow-${timestamp}.pdf`,
      path: await this.pdfGenerator
        .htmlTemplate(
          "financial/cash-flow-report",
          {
            generatedAt: new Date().toISOString(),
            church: church?.getName(),
            filters,
            summary: report.summary,
            series: report.series.map((row) => ({
              ...row,
              period: row.period.toISOString(),
            })),
            projection: {
              label: locale.projectionLabel,
              statusLabel: locale.projectionStatus[report.projection.status],
              ...report.projection,
              buckets: report.projection.buckets.map((row) => ({
                ...row,
                period: row.period.toISOString(),
              })),
            },
            messages: this.buildMessages(request, report),
          },
          request.lang
        )
        .toPDF(false),
    }
  }

  private buildMessages(
    request: CashFlowExportRequest,
    report: Awaited<ReturnType<ICashFlowRepository["getCashFlowDirectReport"]>>
  ): string[] {
    const messagesCatalog = getCashFlowReportCatalog(request.lang).messages
    const messages: string[] = []

    if (report.series.length === 0) {
      messages.push(messagesCatalog.noData)
    }

    if (
      request.includeProjection &&
      report.projection.status === "unavailable"
    ) {
      messages.push(messagesCatalog.projectionUnavailable)
    }

    if (request.includeProjection && report.projection.status === "degraded") {
      messages.push(messagesCatalog.projectionDegraded)
    }

    return messages
  }

  private async buildPdfFilters(request: CashFlowExportRequest): Promise<{
    startDate: string
    endDate: string
    groupBy: string
    groupByLabel: string
    symbol?: string
    method?: string
    methodLabel?: string
    availabilityAccountsLabel?: string
    costCenterId?: string
    includeProjection: boolean
    projectionBuckets?: number
  }> {
    const locale = getCashFlowReportCatalog(request.lang)
    const selectedIds = this.normalizeAvailabilityAccountIds(
      request.availabilityAccountId
    )

    const availableAccounts = await this.availabilityAccountRepository.list({
      churchId: request.churchId,
      ...(request.symbol ? { symbol: request.symbol } : {}),
      ...(request.method ? { accountType: request.method } : {}),
    })

    const selectedAccounts = availableAccounts.filter((account) =>
      selectedIds.includes(account.getAvailabilityAccountId())
    )

    const availabilityAccountsLabel = this.buildAvailabilityAccountsLabel({
      selectedIds,
      availableAccounts,
      selectedAccounts,
      locale,
    })

    return {
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
      groupBy: request.groupBy,
      groupByLabel: locale.groupBy[request.groupBy],
      symbol: request.symbol,
      method: request.method,
      methodLabel: request.method
        ? (locale.accountTypes[request.method] ?? request.method)
        : undefined,
      availabilityAccountsLabel,
      costCenterId: request.costCenterId,
      includeProjection: request.includeProjection === true,
      projectionBuckets: request.projectionBuckets,
    }
  }

  private normalizeAvailabilityAccountIds(
    availabilityAccountId?: string | string[]
  ): string[] {
    if (!availabilityAccountId) {
      return []
    }

    return Array.isArray(availabilityAccountId)
      ? availabilityAccountId
      : [availabilityAccountId]
  }

  private buildAvailabilityAccountsLabel({
    selectedIds,
    availableAccounts,
    selectedAccounts,
    locale,
  }: {
    selectedIds: string[]
    availableAccounts: AvailabilityAccount[]
    selectedAccounts: AvailabilityAccount[]
    locale: ReturnType<typeof getCashFlowReportCatalog>
  }): string | undefined {
    if (selectedIds.length === 0 || availableAccounts.length === 0) {
      return undefined
    }

    if (selectedIds.length >= availableAccounts.length) {
      return locale.availabilityAccounts.all
    }

    if (selectedAccounts.length === 1) {
      return selectedAccounts[0]!.getAccountName()
    }

    if (selectedAccounts.length > 1) {
      return locale.availabilityAccounts.selected(selectedAccounts.length)
    }

    return locale.availabilityAccounts.selected(selectedIds.length)
  }
}
