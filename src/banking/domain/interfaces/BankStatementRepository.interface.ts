import { BankStatement } from "../BankStatement"
import { BankStatementStatus } from "../enums/BankStatementStatus.enum"

export interface IBankStatementRepository {
  upsert(statement: BankStatement): Promise<void>
  bulkInsert(statements: BankStatement[]): Promise<void>
  findByFitId(churchId: string, bank: string, fitId: string): Promise<BankStatement | undefined>
  findByHash(churchId: string, bank: string, hash: string): Promise<BankStatement | undefined>
  findUnmatchedByPeriod(params: {
    churchId: string
    bank?: string
    month: number
    year: number
  }): Promise<BankStatement[]>
  updateStatus(
    statementId: string,
    status: BankStatementStatus,
    financialRecordId?: string
  ): Promise<void>
}

