import { IntermediateBankStatement } from "../types/IntermediateBankStatement.type"

export interface IBankStatementParser {
  supports(bank: string): boolean
  parse(params: {
    filePath: string
    churchId: string
    accountName?: string
    month: number
    year: number
  }): Promise<IntermediateBankStatement[]>
}

