import { FinanceRecord } from "../FinanceRecord"
import type { StatementCategorySummary } from "@/Financial/domain"
import type { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IFinancialRecordRepository extends IRepository<FinanceRecord> {
  deleteByFinancialRecordId(financialRecordId: string): Promise<void>

  titheList(
    filter: object
  ): Promise<{ total: number; tithesOfTithes: number; records: any[] }>

  fetchStatementCategories(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<StatementCategorySummary[]>
}
