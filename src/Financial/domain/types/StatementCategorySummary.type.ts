import { StatementCategory } from "../enums/StatementCategory.enum"

export type StatementCategorySummary = {
  category: StatementCategory
  income: number
  expenses: number
}
