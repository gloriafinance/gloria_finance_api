import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { BankStatement } from "../BankStatement"
import { BankStatementStatus } from "../enums/BankStatementStatus.enum"

export interface IBankStatementRepository {
  upsert(statement: BankStatement): Promise<void>
  bulkInsert(statements: BankStatement[]): Promise<void>
  one(filter: object): Promise<BankStatement | undefined>
  updateStatus(
    statementId: string,
    status: BankStatementStatus,
    financialRecordId?: string
  ): Promise<void>
  list(criteria: Criteria): Promise<Paginate<BankStatement>>
}
