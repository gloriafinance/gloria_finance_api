import * as XLSX from "xlsx"
import { IExcelExportAdapter } from "../domain/interfaces/ExcelExport.interface"

/**
 * Implementación del adaptador de exportación a Excel usando la librería xlsx
 */
export class XlsxExportAdapter implements IExcelExportAdapter {
  /**
   * Exporta los datos a un archivo Excel
   *
   * @param data - Los datos a exportar
   * @param sheetName - El nombre de la hoja de Excel
   * @returns Un buffer con el archivo Excel
   */
  export(data: any[], sheetName: string): Buffer {
    // Crear el libro de trabajo y la hoja
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()

    // Añadir la hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    // Escribir a buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    })

    return excelBuffer
  }
}
