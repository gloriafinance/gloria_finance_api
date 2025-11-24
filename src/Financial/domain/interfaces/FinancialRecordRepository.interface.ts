import { FinanceRecord } from "../FinanceRecord"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { BaseReportRequest } from "@/Reports/domain"
import { StatementCategorySummary } from "@/Financial/domain"

export interface IFinancialRecordRepository {
  upsert(financialRecord: FinanceRecord): Promise<void>

  deleteByFinancialRecordId(financialRecordId: string): Promise<void>

  list(criteria: Criteria): Promise<Paginate<FinanceRecord>>

  one(filter: object): Promise<FinanceRecord | undefined>

  titheList(
    filter: BaseReportRequest
  ): Promise<{ total: number; tithesOfTithes: number; records: any[] }>

  fetchStatementCategories(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<StatementCategorySummary[]>
}
