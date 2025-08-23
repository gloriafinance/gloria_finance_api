import { ConceptType } from "@/Financial/domain"

export type FilterFinanceRecordRequest = {
  financialConceptId?: string
  availabilityAccountId?: string
  conceptType?: ConceptType
  churchId: string
  startDate?: Date
  endDate?: Date
  page: number
  perPage: number
}
