import { Logger, PuppeteerAdapter } from "@/Shared/adapter"
import {
  AssetResponse,
  AssetStatusLabels,
  IAssetRepository,
  InventoryReportRequest,
} from "../domain"
import { AssetCodeGenerator } from "@/Patrimony"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"
import { IChurchRepository } from "@/Church/domain"
import { IXLSExportAdapter, ReportFile } from "@/Shared/domain"

type InventorySummary = {
  totalAssets: number
  totalValue: number
  byStatus: Record<string, number>
  documentsPending: number
}

export class GenerateInventoryReport {
  private readonly logger = Logger(GenerateInventoryReport.name)
  private readonly categoryLabels: Record<string, string> = {
    instrument: "Instrumentos",
    vehicle: "Veículos",
    furniture: "Mobília",
    electronics: "Eletrônicos",
    property: "Imóveis",
    supplies: "Suprimentos",
    other: "Outros",
  }

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly repository: IAssetRepository,
    private readonly pdfGenerator: PuppeteerAdapter,
    private readonly xlsExport: IXLSExportAdapter
  ) {}

  async execute(request: InventoryReportRequest): Promise<ReportFile> {
    this.logger.info("Generating patrimony inventory report", request)

    const filters = AssetCodeGenerator.buildFilters({
      churchId: request.churchId,
      category: request.category,
      status: request.status,
    })

    const assets = await this.repository.search(filters)
    const responses = assets.map(mapAssetToResponse)

    if (request.format === "csv") {
      return await this.buildCsvFile(responses)
    }

    const summary = this.buildSummary(responses)

    return await this.buildPdfFile(responses, summary, request)
  }

  private buildSummary(assets: AssetResponse[]): InventorySummary {
    const totalValue = assets.reduce(
      (acc, asset) => acc + Number(asset.value || 0),
      0
    )

    const byStatus = assets.reduce<Record<string, number>>((acc, asset) => {
      acc[asset.status] = (acc[asset.status] ?? 0) + 1
      return acc
    }, {})

    const documentsPending = assets.filter(
      (asset) => asset.documentsPending
    ).length

    return {
      totalAssets: assets.length,
      totalValue,
      byStatus,
      documentsPending,
    }
  }

  private async buildCsvFile(assets: AssetResponse[]): Promise<ReportFile> {
    const header = [
      "Código",
      "Nome",
      "Categoria",
      "Status",
      "Valor",
      "Congregação",
      "Responsável",
      "Data de aquisição",
      "Localização",
      "Documentos pendentes",
    ]

    const rows = assets.map((asset) => [
      asset.code,
      asset.name,
      this.getCategoryLabel(asset.category),
      AssetStatusLabels[asset.status],
      Number(asset.value ?? 0).toFixed(2),
      asset.churchId,
      asset.responsible?.name ?? asset.responsibleId,
      new Date(asset.acquisitionDate).toISOString().slice(0, 10),
      asset.location,
      asset.documentsPending ? "Sim" : "Não",
    ])

    return await this.xlsExport.export(rows, header, "inventario-patrimonial")
  }

  private async buildPdfFile(
    assets: AssetResponse[],
    summary: InventorySummary,
    request: InventoryReportRequest
  ): Promise<ReportFile> {
    const church = await this.churchRepository.one(request.churchId)

    const templateData = {
      generatedAt: new Date().toISOString(),
      summary: {
        ...summary,
        totalValueFormatted: new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(summary.totalValue),
      },
      filters: {
        church: `${church.getName()}`,
        categoryLabel: this.getCategoryLabel(request.category),
        category: request.category,
        status: request.status,
      },
      assets: assets.map((asset, index) => ({
        ...asset,
        categoryLabel: this.getCategoryLabel(asset.category),
        index: index + 1,
        acquisitionDateFormatted: new Date(
          asset.acquisitionDate
        ).toLocaleDateString("pt-BR"),
        statusLabel: AssetStatusLabels[asset.status],
        responsibleName: asset.responsible?.name ?? asset.responsibleId,
        valueFormatted: new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(Number(asset.value ?? 0)),
      })),
    }

    const timestamp = Date.now()
    const filename = `inventario-patrimonial-${timestamp}.pdf`

    return {
      path: await this.pdfGenerator
        .htmlTemplate("patrimony/inventory-report", templateData)
        .toPDF(false),
      filename: filename,
    }
  }

  private getCategoryLabel(category?: string): string {
    if (!category) {
      return ""
    }

    const normalized = category.toLowerCase()

    return this.categoryLabels[normalized] ?? category
  }
}
