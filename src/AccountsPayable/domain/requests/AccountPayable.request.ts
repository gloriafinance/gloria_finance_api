import { AccountPayableTaxMetadata } from "../types/AccountPayableTax.type"
import { AccountPayableTaxStatus } from "../enums/AccountPayableTaxStatus.enum"

export type AccountPayableRequest = {
  supplierId: string
  churchId: string
  description: string
  amountTotal?: number
  installments?: {
    amount: number
    dueDate: Date
  }[]
  taxes?: {
    taxType: string
    percentage: number
    amount?: number
    status?: AccountPayableTaxStatus
  }[]
  taxMetadata?: AccountPayableTaxMetadata
}
