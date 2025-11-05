import { BankStatementStatus } from "../enums/BankStatementStatus.enum"

export type ListBankStatementsRequest = {
  churchId: string
  bank?: string
  status?: BankStatementStatus
  month?: number
  year?: number
  dateFrom?: Date
  dateTo?: Date
}

