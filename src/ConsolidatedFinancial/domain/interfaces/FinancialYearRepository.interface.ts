import { FinancialMonth } from "../FinancialMonth"
import { Criteria, IRepository, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IFinancialYearRepository extends IRepository<FinancialMonth> {
  upsert(financialYear: FinancialMonth): Promise<void>

  one(filter: object): Promise<FinancialMonth | undefined>

  list(filter: object): Promise<FinancialMonth[]>

  list(criteria: Criteria): Promise<Paginate<FinancialMonth>>
}
