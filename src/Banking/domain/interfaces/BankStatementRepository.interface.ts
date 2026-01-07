import { IRepository } from "@abejarano/ts-mongodb-criteria"
import { BankStatement } from "../BankStatement"
import { BankStatementStatus } from "@/Banking/domain"

export interface IBankStatementRepository extends IRepository<BankStatement> {
  bulkInsert(statements: BankStatement[]): Promise<void>

  updateStatus(
    statementId: string,
    status: BankStatementStatus,
    financialRecordId?: string
  ): Promise<void>
}
