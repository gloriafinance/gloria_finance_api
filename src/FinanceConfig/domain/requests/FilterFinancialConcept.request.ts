import { ConceptType, StatementCategory } from "@/Financial/domain"

export type FilterFinancialConceptRequest = {
  type?: ConceptType
  statementCategory?: StatementCategory
}
