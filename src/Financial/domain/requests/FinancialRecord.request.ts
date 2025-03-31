import { TypeBankingOperation } from "@/MovementBank/domain"

export type FinancialRecordQueueRequest = {
  financialConceptId?: string
  churchId: string
  amount: number
  date: Date
  availabilityAccountId: string
  voucher?: string
  description?: string
  costCenterId?: string
}

export type FinancialRecordRequest = {
  file?: any
  bankingOperation?: TypeBankingOperation
} & FinancialRecordQueueRequest
