import { AmountValue } from "@/Shared/domain"
import { FinancialConcept } from "@/Financial/domain"

export type PayAccountPayableRequest = {
  accountPayableId: string
  installmentId: string
  installmentIds: string[]
  financialTransactionId: string
  availabilityAccountId: string
  churchId: string
  amount: AmountValue
  file?: any
  voucher?: string
  concept: FinancialConcept
}
