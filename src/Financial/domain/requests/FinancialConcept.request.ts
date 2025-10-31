import {
  ConceptType,
  FinancialConceptImpactOverrides,
  StatementCategory,
} from "@/Financial/domain"

export type FinancialConceptImpactRequest = FinancialConceptImpactOverrides

export type FinancialConceptRequest = {
  name: string
  description: string
  type: ConceptType
  statementCategory: StatementCategory
  active: boolean
  churchId: string
  financialConceptId?: string
} & FinancialConceptImpactRequest
