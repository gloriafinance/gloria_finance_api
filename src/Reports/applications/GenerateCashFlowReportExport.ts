import type { IChurchRepository } from "@/Church/domain/interfaces/ChurchRepository.interface.ts"
import type {
  CashFlowExportRequest,
  ICashFlowRepository,
} from "@/Reports/domain"
import { Logger } from "@/Shared/adapter"
import { PuppeteerAdapter } from "@/Shared/adapter/GeneratePDF.adapter"
import type { IXLSExportAdapter, ReportFile } from "@/Shared/domain"

const PROJECTION_LABEL = "Proyección base (estimación por media móvil 3M)"

export class GenerateCashFlowReportExport {
  private logger = Logger(GenerateCashFlowReportExport.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly cashFlowRepository: ICashFlowRepository,
    private readonly pdfGenerator: PuppeteerAdapter,
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
    const timestamp = Date.now()

    return {
      filename: `cash-flow-${timestamp}.pdf`,
      path: await this.pdfGenerator
        .htmlTemplate(
          "financial/cash-flow-report",
          {
            generatedAt: new Date().toISOString(),
            church: church?.getName(),
            filters: {
              ...request,
              startDate: request.startDate.toISOString(),
              endDate: request.endDate.toISOString(),
            },
            summary: report.summary,
            series: report.series.map((row) => ({
              ...row,
              period: row.period.toISOString(),
            })),
            projection: {
              label: PROJECTION_LABEL,
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
    const messages: string[] = []

    if (report.series.length === 0) {
      messages.push("No hay datos para los filtros seleccionados.")
    }

    if (
      request.includeProjection &&
      report.projection.status === "unavailable"
    ) {
      messages.push("Proyección indisponible por histórico insuficiente.")
    }

    if (request.includeProjection && report.projection.status === "degraded") {
      messages.push("Proyección calculada con menos de 3 meses de histórico.")
    }

    return messages
  }
}
