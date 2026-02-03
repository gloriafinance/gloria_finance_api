import {
  AvailabilityAccount,
  CostCenter,
  FinancialConcept,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"

export type CreateFinanceRecord = {
  financialConcept?: FinancialConcept
  type: FinancialRecordType
  churchId: string
  amount: number
  date: Date
  createdBy: string
  status: FinancialRecordStatus
  source: FinancialRecordSource
  availabilityAccount: AvailabilityAccount
  description?: string
  voucher?: string
  costCenter?: CostCenter
  reference?: {
    type: string
    entityId: string
  }
}
