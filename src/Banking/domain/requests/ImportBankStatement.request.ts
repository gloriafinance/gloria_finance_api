export type ImportBankStatementRequest = {
  bankId: string
  month: number | string
  year: number | string
  churchId: string
  fileContent: string
  uploadedBy: string
}
