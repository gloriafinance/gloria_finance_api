import { Bank, IntermediateBankStatement } from "@/Banking/domain"

export interface IBankStatementParser {
  supports(bank: string): boolean
  parse(params: {
    bank: Bank
    availabilityAccount: {
      accountName: string
      availabilityAccountId: string
    }
    filePath: string
    accountName?: string
    month: number
    year: number
  }): Promise<IntermediateBankStatement[]>
}
