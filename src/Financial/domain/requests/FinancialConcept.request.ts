import { ConceptType, StatementCategory } from "@/Financial/domain"

export type FinancialConceptRequest = {
  name: string
  description: string
  type: ConceptType
  statementCategory: StatementCategory
  active: boolean
  churchId: string
  financialConceptId?: string
}
