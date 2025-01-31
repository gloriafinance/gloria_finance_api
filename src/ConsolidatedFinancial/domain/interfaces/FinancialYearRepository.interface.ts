import { FinancialMonth } from "../FinancialMonth"

export interface IFinancialYearRepository {
  upsert(financialYear: FinancialMonth): Promise<void>

  one(filter: Object): Promise<FinancialMonth | undefined>
}
