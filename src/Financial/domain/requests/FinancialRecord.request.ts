import { TypeBankingOperation } from "@/MovementBank/domain"
import {
  AvailabilityAccount,
  CostCenter,
  FinancialConcept,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"

export type FinancialRecordCreateQueue = {
  churchId: string
  amount: number
  description: string
  date: Date
  financialRecordType: FinancialRecordType
  source: FinancialRecordSource
  status: FinancialRecordStatus
  costCenter?: CostCenter
  financialConcept: FinancialConcept
  availabilityAccount?: any
  createdBy: string
  file?: any
  voucher?: string
  reference?: {
    type: string
    entityId: string
  }
}

export type FinancialRecordUpdateQueue = {
  file?: any
  financialRecord: any
  status?: FinancialRecordStatus
  costCenter?: CostCenter
  availabilityAccount?: AvailabilityAccount
}

export type FinancialRecordRequest = {
  file?: any
  bankingOperation?: TypeBankingOperation
  financialConceptId?: string
  churchId: string
  amount: number
  date: Date
  availabilityAccountId: string
  voucher?: string
  description?: string
  costCenterId?: string
  source: FinancialRecordSource
  status: FinancialRecordStatus
}
