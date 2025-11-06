import { Bank, BankStatementDirection } from "@/Banking/domain"

export type IntermediateBankStatement = {
  bank: Bank
  availabilityAccount: {
    accountName: string
    availabilityAccountId: string
  }
  bankRefId: string
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
