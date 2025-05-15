export interface IHTMLAdapter {
  /**
   * Genera un archivo HTML a partir de una plantilla y datos
   *
   * @param templateName - Ruta de la plantilla HTML
   * @param data - Datos a inyectar en la plantilla
   * @returns Un buffer con el archivo HTML generado
   */
  generateHTML(templateName: string, data: any): string
}
