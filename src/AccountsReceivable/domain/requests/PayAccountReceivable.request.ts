import { AmountValue } from "@/Shared/domain"

export type PayAccountReceivableRequest = {
  accountReceivableId: string
  installmentId: string
  installmentIds: string[]
  financialTransactionId: string
  financialRecordId?: string
  availabilityAccountId: string
  churchId: string
  amount: AmountValue
  date: Date
  file?: any
  voucher?: string
  concept: any
  createdBy: string
  symbol: string
}
