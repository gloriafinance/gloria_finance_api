export type ImportBankStatementRequest = {
  bankId: string
  month: number | string
  year: number | string
  churchId: string
  file: any
  uploadedBy: string
}
