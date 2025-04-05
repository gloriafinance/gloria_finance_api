import { Response } from "express"
import { FilterFinanceRecordRequest } from "@/Financial/domain"
import { ExportFinanceRecordToExcel } from "../../../applications"
import { FinanceRecordMongoRepository } from "../../persistence"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { HttpStatus } from "@/Shared/domain"
import { Logger, XlsxExportAdapter } from "@/Shared/adapter"

/**
 * ExportFinanceRecordToExcelController
 *
 * @description Exporta a Excel un listado de registros financieros filtrados según los criterios proporcionados.
 *
 * @param {FilterFinanceRecordRequest} req - Los criterios de filtro.
 * @param {Response} res - El objeto respuesta.
 *
 * @returns {Promise<void>} - Una promesa que se resuelve cuando la solicitud ha sido procesada.
 *
 * @throws {Error} - Si la solicitud es inválida o ocurre un error.
 *
 * @example
 * // Request
 * GET /finance-records/export?churchId=123&startDate=2022-01-01&endDate=2022-12-31
 */
export const ExportFinanceRecordToExcelController = async (
  req: FilterFinanceRecordRequest,
  res: Response
): Promise<void> => {
  const logger = Logger("ExportFinanceRecordToExcelController")
  try {
    logger.info("Iniciando exportación a Excel", req)

    // Crear una instancia del adaptador de Excel
    const xlsxExportAdapter = new XlsxExportAdapter()

    // Ejecutar el caso de uso con el adaptador
    const buffer = await new ExportFinanceRecordToExcel(
      FinanceRecordMongoRepository.getInstance(),
      xlsxExportAdapter
    ).execute(req)

    // Generar un nombre de archivo descriptivo
    const datePart = new Date().toISOString().substring(0, 10)
    const timePart = new Date().getTime()
    const dateFilter =
      req.startDate && req.endDate
        ? `_${new Date(req.startDate).toISOString().substring(0, 10)}_a_${new Date(req.endDate).toISOString().substring(0, 10)}`
        : ""
    const fileName = `RegistrosFinancieros${dateFilter}_${datePart}_${timePart}.xlsx`

    logger.info(`Enviando archivo: ${fileName}`)

    // Configurar las cabeceras de la respuesta para la descarga de archivo Excel
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`)

    // Enviar el buffer como respuesta
    res.status(HttpStatus.OK).send(buffer)

    logger.info("Exportación finalizada con éxito")
  } catch (e) {
    logger.error("Error al exportar a Excel", e)
    domainResponse(e, res)
  }
}
