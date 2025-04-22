import { FilterFinanceRecordRequest } from "../../domain"
import {
  Criteria,
  Filters,
  IExcelExportAdapter,
  Operator,
  Order,
  OrderTypes,
} from "@/Shared/domain"
import { IFinancialRecordRepository } from "../../domain/interfaces"
import { FinanceRecord } from "../../domain/FinanceRecord"
import { Logger } from "@/Shared/adapter"

export class ExportFinanceRecordToExcel {
  private logger = Logger(ExportFinanceRecordToExcel.name)

  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly excelExportAdapter: IExcelExportAdapter
  ) {}

  async execute(request: FilterFinanceRecordRequest): Promise<Buffer> {
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

      const records = await this.financialRecordRepository.fetch(
        this.prepareCriteria(paginatedRequest)
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
    const worksheetData = this.prepareDataForExcel(allRecords)
    this.logger.info(`Exportando ${worksheetData.length} registros a Excel`)

    // Usar el adaptador para exportar los datos
    return await this.excelExportAdapter.export(
      worksheetData,
      "Registros Financieros"
    )
  }

  private prepareDataForExcel(records: FinanceRecord[]): any[] {
    return records.map((record: any) => {
      return {
        ID: record.financialRecordId,
        Fecha: record.date.toLocaleDateString(),
        Monto: record.amount,
        Descripción: record.description || "",
        Tipo: record.type,
        Cuenta: record.availabilityAccount?.accountName || "N/A",
        "Concepto Financiero": record.financialConcept?.name || "N/A",
        "Centro de Costo": record.costCenter?.name || "N/A",
      }
    })
  }

  private prepareCriteria(request: FilterFinanceRecordRequest) {
    const filters = []

    if (request.availabilityAccountId) {
      filters.push(
        new Map([
          ["field", "availabilityAccount.availabilityAccountId"],
          ["operator", Operator.EQUAL],
          ["value", request.availabilityAccountId],
        ])
      )
    }

    if (request.churchId) {
      filters.push(
        new Map([
          ["field", "churchId"],
          ["operator", Operator.EQUAL],
          ["value", request.churchId],
        ])
      )
    }

    if (request.financialConceptId) {
      filters.push(
        new Map([
          ["field", "financialConcept.financialConceptId"],
          ["operator", Operator.EQUAL],
          ["value", request.financialConceptId],
        ])
      )
    }

    if (request.startDate && !request.endDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "date"],
          ["operator", Operator.GTE],
          ["value", request.startDate],
        ])
      )
    }

    if (!request.startDate && request.endDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "date"],
          ["operator", Operator.LTE],
          ["value", request.endDate],
        ])
      )
    }

    if (request.startDate && request.endDate) {
      filters.push(
        new Map<string, string | any>([
          ["field", "date"],
          ["operator", Operator.DATE_RANGE],
          [
            "value",
            {
              startDate: request.startDate,
              endDate: request.endDate,
            },
          ],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("date", OrderTypes.DESC),
      request.perPage,
      request.page
    )
  }
}
