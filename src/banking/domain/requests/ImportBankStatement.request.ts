export type ImportBankStatementRequest = {
  bank: string
  churchId: string
  month: number
  year: number
  accountName?: string
  uploadedBy: string
  file: {
    name: string
    tempFilePath?: string
    data?: Buffer
  }
}

