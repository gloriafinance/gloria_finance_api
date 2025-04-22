/**
 * Interfaz para el adaptador de exportación a Excel
 *
 * Esta interfaz define los métodos necesarios para exportar datos a Excel
 */
export interface IExcelExportAdapter {
  /**
   * Exporta los datos a un archivo Excel
   *
   * @param data - Los datos a exportar
   * @param sheetName - El nombre de la hoja de Excel
   * @returns Un buffer con el archivo Excel
   */
  export(data: any[], sheetName: string): Promise<Buffer>
}
