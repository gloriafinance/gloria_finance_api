import { Bank, type IntermediateBankStatement } from "@/Banking/domain"

export interface IBankStatementParser {
  supports(bank: string): boolean
  parse(params: {
    bank: Bank
    availabilityAccount: {
      accountName: string
      availabilityAccountId: string
    }
    fileContent: string
    accountName?: string
    month: number
    year: number
  }): Promise<IntermediateBankStatement[]>
}
