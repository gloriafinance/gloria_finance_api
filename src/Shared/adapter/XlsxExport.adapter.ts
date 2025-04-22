import * as ExcelJS from "exceljs"
import { GenericException, IExcelExportAdapter } from "@/Shared/domain"

/**
 * Implementing the Excel Export Adapter using ExcelJS
 */
export class XlsxExportAdapter implements IExcelExportAdapter {
  /**
   * Exporta los datos a un archivo Excel
   *
   * @param data - Los datos a exportar
   * @param sheetName - El nombre de la hoja de Excel
   * @returns Un buffer con el archivo Excel
   */
  async export(data: any[], sheetName: string): Promise<Buffer> {
    if (!Array.isArray(data)) {
      throw new GenericException("Not a valid data")
    }

    const workbook = new ExcelJS.Workbook()

    const worksheet = workbook.addWorksheet(sheetName)

    if (data.length === 0) {
      return (await workbook.xlsx.writeBuffer()) as Buffer
    }

    const headers = Object.keys(data[0])

    worksheet.addRow(headers)

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      }
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      }
    })

    data.forEach((item) => {
      const rowValues = headers.map((header) => item[header])
      worksheet.addRow(rowValues)
    })

    return (await workbook.xlsx.writeBuffer()) as Buffer
  }
}
