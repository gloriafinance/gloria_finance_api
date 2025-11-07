import {
  CostCenter,
  FinancialConcept,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"
import { TypeBankingOperation } from "@/Banking/domain"

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

export type UpdateStatusFinancialRecordQueue = {
  financialRecord: any
  status: FinancialRecordStatus
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
