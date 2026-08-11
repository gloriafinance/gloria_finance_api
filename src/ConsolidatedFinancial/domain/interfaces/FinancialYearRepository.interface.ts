import { FinancialMonth } from "../FinancialMonth"
import { type IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IFinancialYearRepository extends IRepository<FinancialMonth> {}
