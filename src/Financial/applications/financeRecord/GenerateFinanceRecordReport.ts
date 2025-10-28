import {
  ConceptType,
  ConceptTypeLabels,
  FinanceRecordReportRequest,
} from "../../domain"
import { IFinancialRecordRepository } from "../../domain/interfaces"
import { Logger, PuppeteerAdapter } from "@/Shared/adapter"
import { IXLSExportAdapter, ReportFile } from "@/Shared/domain"
import { PrepareFinanceRecordCriteria } from "./ListFilters"
import { IChurchRepository } from "@/Church/domain"

type FinanceRecordSummary = {
  totalsByType: Array<{
    type: ConceptType
    typeCode: string
    typeLabel: string
    count: number
    total: number
    totalFormatted: string
    signedTotal: number
    signedTotalFormatted: string
    isExpense: boolean
  }>
  totalRecords: number
  netResult: number
  netResultFormatted: string
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const conceptTypeCodes: Record<ConceptType, string> = {
  [ConceptType.INCOME]: "INCOME",
  [ConceptType.DISCHARGE]: "OUT",
  [ConceptType.PURCHASE]: "PURCHASE",
  [ConceptType.REVERSAL]: "REVERSAL",
}

const normalizeConceptType = (value: unknown): ConceptType | undefined => {
  if (!value) {
    return undefined
  }

  const normalized = String(value).toUpperCase()

  switch (normalized) {
    case "INCOME":
      return ConceptType.INCOME
    case "OUTGO":
      return ConceptType.DISCHARGE
    case "PURCHASE":
      return ConceptType.PURCHASE
    case "REVERSAL":
      return ConceptType.REVERSAL
    default:
      return undefined
  }
}

export class GenerateFinanceRecordReport {
  private logger = Logger(GenerateFinanceRecordReport.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly pdfGenerator: PuppeteerAdapter,
    private readonly excelExportAdapter: IXLSExportAdapter
  ) {}

  async execute(request: FinanceRecordReportRequest): Promise<ReportFile> {
    const format = request.format ?? "csv"

    this.logger.info(
      "Iniciando geração do relatório de registros financeiros",
      {
        ...request,
        format,
      }
    )

    const records = await this.fetchAllRecords(request)

    if (format === "pdf") {
      const summary = this.buildSummary(records)
      return await this.buildPdfFile(records, summary, request)
    }

    return await this.buildCsvFile(records)
  }

  private async fetchAllRecords(
    request: FinanceRecordReportRequest
  ): Promise<any[]> {
    let currentPage = 1
    const perPage = 1000
    let hasMoreRecords = true
    let allRecords: any[] = []

    while (hasMoreRecords) {
      const paginatedRequest = {
        ...request,
        page: currentPage,
        perPage,
      }

      this.logger.info(`Coletando página ${currentPage} de registros`)

      const records = await this.financialRecordRepository.list(
        PrepareFinanceRecordCriteria(paginatedRequest)
      )

      allRecords = [...allRecords, ...records.results]

      if (records.nextPag == null) {
        hasMoreRecords = false
        this.logger.info(`Total de registros coletados: ${allRecords.length}`)
      }

      currentPage++
    }

    return allRecords
  }

  private buildSummary(records: any[]): FinanceRecordSummary {
    const expenseTypes = new Set<ConceptType>([
      ConceptType.DISCHARGE,
      ConceptType.PURCHASE,
      ConceptType.REVERSAL,
    ])

    const totals = records.reduce<
      Record<
        ConceptType,
        {
          amount: number
          count: number
        }
      >
    >(
      (acc, record) => {
        const type = normalizeConceptType(record.type)

        if (!type) {
          return acc
        }

        const current = acc[type] ?? { amount: 0, count: 0 }

        current.amount += Number(record.amount)
        current.count += 1
        acc[type] = current

        return acc
      },
      {} as Record<ConceptType, { amount: number; count: number }>
    )

    const totalsByType = (Object.values(ConceptType) as ConceptType[]).map(
      (type) => {
        const data = totals[type] ?? { amount: 0, count: 0 }
        const isExpense = expenseTypes.has(type)
        const signedTotal = isExpense ? -data.amount : data.amount

        return {
          type,
          typeCode: conceptTypeCodes[type],
          typeLabel: ConceptTypeLabels[type],
          count: data.count,
          total: data.amount,
          totalFormatted: currencyFormatter.format(data.amount),
          signedTotal,
          signedTotalFormatted: currencyFormatter.format(signedTotal),
          isExpense,
        }
      }
    )

    const netResult = totalsByType.reduce(
      (acc, item) => acc + item.signedTotal,
      0
    )

    return {
      totalsByType,
      totalRecords: records.length,
      netResult,
      netResultFormatted: currencyFormatter.format(netResult),
    }
  }

  private async buildCsvFile(records: any[]): Promise<ReportFile> {
    const header = [
      "Data",
      "Montante",
      "Descrição",
      "Tipo",
      "Conta de Disponibilidade",
      "Conceito Financeiro",
      "Centro de Custo",
    ]

    const rows = records.map((record) => {
      const type = normalizeConceptType(record.type)
      const typeLabel = type
        ? ConceptTypeLabels[type]
        : String(record.type ?? "")
      const conceptName =
        record.financialConcept?.name ??
        record.financialConcept?.financialConcept?.name ??
        "N/A"
      const availabilityAccountName =
        record.availabilityAccount?.accountName ??
        record.availabilityAccount?.availabilityAccount?.accountName ??
        "N/A"
      const costCenterName =
        record.costCenter?.name ?? record.costCenter?.costCenterName ?? "N/A"

      return [
        new Date(record.date).toISOString().slice(0, 10),
        record.amount,
        record.description ?? "",
        typeLabel,
        availabilityAccountName,
        conceptName,
        costCenterName,
      ]
    })

    return await this.excelExportAdapter.export(
      rows,
      header,
      "registros-financeiros"
    )
  }

  private async buildPdfFile(
    records: any[],
    summary: FinanceRecordSummary,
    request: FinanceRecordReportRequest
  ): Promise<ReportFile> {
    const church = await this.churchRepository.one(request.churchId)
    const churchName = church?.getName() ?? "Congregação não informada"

    const templateData = {
      generatedAt: new Date().toISOString(),
      title: "Relatório de Movimentos Financeiros",
      church: churchName,
      filters: {
        startDate: request.startDate
          ? new Date(request.startDate).toISOString()
          : undefined,
        endDate: request.endDate
          ? new Date(request.endDate).toISOString()
          : undefined,
        conceptType: request.conceptType,
      },
      summary,
      records: records.map((record, index) => {
        const type = normalizeConceptType(record.type)
        const typeLabel = type
          ? ConceptTypeLabels[type]
          : String(record.type ?? "")
        const typeCode = type
          ? conceptTypeCodes[type]
          : String(record.type ?? "")

        return {
          index: index + 1,
          date: new Date(record.date).toISOString(),
          amount: record.amount,
          amountFormatted: currencyFormatter.format(Number(record.amount ?? 0)),
          description: record.description ?? "",
          type: typeCode,
          typeLabel,
          conceptName:
            record.financialConcept?.name ??
            record.financialConcept?.financialConcept?.name ??
            "N/A",
          availabilityAccount:
            record.availabilityAccount?.accountName ??
            record.availabilityAccount?.availabilityAccount?.accountName ??
            "N/A",
          costCenter:
            record.costCenter?.name ??
            record.costCenter?.costCenterName ??
            "N/A",
          voucher: record.voucher ?? "",
        }
      }),
    }

    const timestamp = Date.now()
    const filename = `registros-financeiros-${timestamp}.pdf`

    return {
      path: await this.pdfGenerator
        .htmlTemplate("financial/finance-record-report", templateData)
        .toPDF(false),
      filename,
    }
  }
}
