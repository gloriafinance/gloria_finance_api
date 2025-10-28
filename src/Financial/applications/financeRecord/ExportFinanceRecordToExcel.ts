import { ConceptTypeLabels, FilterFinanceRecordRequest } from "../../domain"
import { IFinancialRecordRepository } from "../../domain/interfaces"
import { FinanceRecord } from "@/Financial/domain"
import { Logger } from "@/Shared/adapter"
import { IXLSExportAdapter, ReportFile } from "@/Shared/domain"
import { PrepareFinanceRecordCriteria } from "./ListFilters"

export class ExportFinanceRecordToExcel {
  private logger = Logger(ExportFinanceRecordToExcel.name)

  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly excelExportAdapter: IXLSExportAdapter
  ) {}

  async execute(request: FilterFinanceRecordRequest): Promise<ReportFile> {
    this.logger.info(
      "Iniciando exportación de registros financieros a Excel",
      request
    )

    // Configurar la paginación para obtener todos los registros
    let currentPage = 1
    const perPage = 1000
    let hasMoreRecords = true
    let allRecords: FinanceRecord[] = []

    // Iterar mientras haya más páginas de registros
    while (hasMoreRecords) {
      const paginatedRequest = {
        ...request,
        page: currentPage,
        perPage: perPage,
      }

      this.logger.info(`Obteniendo página ${currentPage} de registros`)

      const records = await this.financialRecordRepository.list(
        PrepareFinanceRecordCriteria(paginatedRequest)
      )

      // Agregar los registros de esta página al array total
      allRecords = [...allRecords, ...records.results]

      // Verificar si hay más páginas
      if (records.nextPag == null) {
        hasMoreRecords = false
        this.logger.info(`Total de registros obtenidos: ${allRecords.length}`)
      }

      currentPage++
    }

    // Transformar los registros para el archivo Excel
    this.logger.info(`Exportando ${allRecords.length} registros a Excel`)

    // Usar el adaptador para exportar los datos
    return await this.excelExportAdapter.export(
      allRecords.map((record: any) => [
        new Date(record.date).toISOString().slice(0, 10),
        record.amount,
        record.description || "",
        ConceptTypeLabels[record.type],
        record.availabilityAccount?.accountName || "N/A",
        record.financialConcept?.name || "N/A",
        record.costCenter?.name || "N/A",
      ]),
      [
        "Data",
        "Monto",
        "Descrição",
        "Tipo",
        "Conta Disponibilidade",
        "Conceito Financiero",
        "Centro de Custo",
      ],
      "Registros Financieros"
    )
  }
}
