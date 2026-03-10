import { ConceptType } from "@/Financial/domain"

export type FilterFinanceRecordRequest = {
  financialConceptId?: string
  availabilityAccountId?: string
  conceptType?: ConceptType
  referenceType?: string
  referenceEntityId?: string
  churchId: string
  startDate?: Date
  endDate?: Date
  page: number
  perPage: number
}
