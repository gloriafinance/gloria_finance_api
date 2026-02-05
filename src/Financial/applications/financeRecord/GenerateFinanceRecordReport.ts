import { ConceptType, ConceptTypeLabels, type FinanceRecordReportRequest, } from "../../domain"
import type { IFinancialRecordRepository } from "../../domain/interfaces"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { PuppeteerAdapter } from "@/Shared/adapter/GeneratePDF.adapter"
import type { IXLSExportAdapter, ReportFile } from "@/Shared/domain"
import { PrepareFinanceRecordCriteria } from "./ListFilters"
import type { IChurchRepository } from "@/Church/domain"

type FinanceRecordSummaryBySymbol = {
  symbol?: string
  totalsByType: Array<{
    type: ConceptType
    typeCode: string
    typeLabelKey: string
    movementLabelKey: string
    count: number
    total: number
    totalFormatted: string
    signedTotal: number
    signedTotalFormatted: string
    isExpense: boolean
    isReversal: boolean
    shouldShow: boolean
  }>
  totalRecords: number
  totalRecordsLabelKey: string
  netResult: number
  netResultFormatted: string
  totalIncome: number
  totalIncomeFormatted: string
  totalExpenses: number
  totalExpensesFormatted: string
  totalReversal: number
  totalReversalFormatted: string
}

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const roundAmount = (amount: number): number => {
  const rounded = Math.round(amount * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

const formatAmount = (amount: number, symbol?: string): string => {
  const formatted = numberFormatter.format(roundAmount(amount))
  return symbol ? `${symbol} ${formatted}` : formatted
}

const conceptTypeCodes: Record<ConceptType, string> = {
  [ConceptType.INCOME]: "INCOME",
  [ConceptType.OUTGO]: "OUT",
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
      return ConceptType.OUTGO
    case "PURCHASE":
      return ConceptType.PURCHASE
    case "REVERSAL":
      return ConceptType.REVERSAL
    default:
      return undefined
  }
}

const conceptTypeLabelKey = (type: ConceptType): string =>
  `finance_record_report.type.${conceptTypeCodes[type]}`

const movementLabelKey = (count: number): string =>
  count === 1
    ? "finance_record_report.movement_singular"
    : "finance_record_report.movement_plural"

const getRecordSymbol = (record: any): string | undefined =>
  record?.availabilityAccount?.symbol ??
  record?.availabilityAccount?.availabilityAccount?.symbol ??
  record?.symbol

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
      const summaryBySymbol = this.buildSummaryBySymbol(records)
      return await this.buildPdfFile(records, summaryBySymbol, request)
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

  private buildSummary(
    records: any[],
    symbol?: string
  ): FinanceRecordSummaryBySymbol {
    const expenseTypes = new Set<ConceptType>([
      ConceptType.OUTGO,
      ConceptType.PURCHASE,
    ])

    const totalsByNature = {
      income: 0,
      expenses: 0,
      reversal: 0,
    }

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
        const isReversal = type === ConceptType.REVERSAL
        const signedTotal = isExpense || isReversal ? -data.amount : data.amount
        const roundedAmount = roundAmount(data.amount)
        const shouldShow =
          !(data.count === 0 && Math.abs(roundedAmount) === 0)

        if (type === ConceptType.INCOME) {
          totalsByNature.income += data.amount
        } else if (expenseTypes.has(type)) {
          totalsByNature.expenses += data.amount
        } else if (isReversal) {
          totalsByNature.reversal += data.amount
        }

        return {
          type,
          typeCode: conceptTypeCodes[type],
          typeLabelKey: conceptTypeLabelKey(type),
          movementLabelKey: movementLabelKey(data.count),
          count: data.count,
          total: data.amount,
          totalFormatted: formatAmount(data.amount, symbol),
          signedTotal,
          signedTotalFormatted: formatAmount(signedTotal, symbol),
          isExpense: isExpense || isReversal,
          isReversal,
          shouldShow,
        }
      }
    )

    const netResult =
      totalsByNature.income - totalsByNature.expenses - totalsByNature.reversal

    return {
      symbol,
      totalsByType: totalsByType.filter((row) => row.shouldShow),
      totalRecords: records.length,
      totalRecordsLabelKey: movementLabelKey(records.length),
      netResult,
      netResultFormatted: formatAmount(netResult, symbol),
      totalIncome: totalsByNature.income,
      totalIncomeFormatted: formatAmount(totalsByNature.income, symbol),
      totalExpenses: totalsByNature.expenses,
      totalExpensesFormatted: formatAmount(
        totalsByNature.expenses,
        symbol
      ),
      totalReversal: totalsByNature.reversal,
      totalReversalFormatted: formatAmount(
        -Math.abs(totalsByNature.reversal),
        symbol
      ),
    }
  }

  private buildSummaryBySymbol(
    records: any[]
  ): FinanceRecordSummaryBySymbol[] {
    const groups = new Map<
      string,
      {
        symbol?: string
        records: any[]
      }
    >()

    for (const record of records) {
      const symbol = getRecordSymbol(record)
      const key = symbol ?? "__NO_SYMBOL__"
      const group = groups.get(key) ?? { symbol, records: [] }
      group.records.push(record)
      groups.set(key, group)
    }

    return Array.from(groups.values()).map((group) =>
      this.buildSummary(group.records, group.symbol)
    )
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
      const numericAmount = Number(record.amount ?? 0)
      const displayAmount =
        type === ConceptType.REVERSAL ? -Math.abs(numericAmount) : numericAmount
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
        displayAmount,
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
    summaryBySymbol: FinanceRecordSummaryBySymbol[],
    request: FinanceRecordReportRequest
  ): Promise<ReportFile> {
    const church = await this.churchRepository.findById(request.churchId)
    const churchName = church?.getName()

    const templateData = {
      generatedAt: new Date().toISOString(),
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
      summaryBySymbol,
      records: records.map((record, index) => {
        const type = normalizeConceptType(record.type)
        const typeCode = type
          ? conceptTypeCodes[type]
          : String(record.type ?? "")
        const typeLabelKey = type ? conceptTypeLabelKey(type) : undefined
        const amountValue = Number(record.amount ?? 0)
        const displayAmount =
          type === ConceptType.REVERSAL ? -Math.abs(amountValue) : amountValue
        const symbol = getRecordSymbol(record)

        return {
          index: index + 1,
          date: new Date(record.date).toISOString(),
          amount: displayAmount,
          amountFormatted: formatAmount(displayAmount, symbol),
          description: record.description ?? "",
          type: typeCode,
          typeLabelKey,
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
        .htmlTemplate(
          "financial/finance-record-report",
          templateData,
          request.lang
        )
        .toPDF(false),
      filename,
    }
  }
}
