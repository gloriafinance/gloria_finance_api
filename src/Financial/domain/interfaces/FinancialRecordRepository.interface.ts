import { FinanceRecord } from "../FinanceRecord"
import type { StatementCategorySummary } from "@/Financial/domain"

export interface IFinancialRecordRepository {
  upsert(financialRecord: FinanceRecord): Promise<void>

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
