import { BankStatementDirection } from "../enums/BankStatementDirection.enum"

export type IntermediateBankStatement = {
  bank: string
  bankRefId: string
  churchId: string
  accountName: string
  postedAt: Date
  amount: number
  description: string
  direction: BankStatementDirection
  fitId: string
  hash: string
  month: number
  year: number
  raw?: Record<string, unknown>
}

