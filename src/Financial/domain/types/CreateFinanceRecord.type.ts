import {
  AvailabilityAccount,
  ConceptType,
  CostCenter,
  FinancialConcept,
} from "@/Financial/domain"

export type CreateFinanceRecord = {
  financialConcept?: FinancialConcept
  type: ConceptType
  churchId: string
  amount: number
  date: Date
  availabilityAccount: AvailabilityAccount
  description?: string
  voucher?: string
  costCenter?: CostCenter
}
