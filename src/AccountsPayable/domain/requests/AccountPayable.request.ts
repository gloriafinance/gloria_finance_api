import { AccountPayableTaxMetadata } from "../types/AccountPayableTax.type"

export type AccountPayableRequest = {
  supplierId: string
  churchId: string
  description: string
  installments: {
    amount: number
    dueDate: Date
  }[]
  taxes?: {
    taxType: string
    percentage: number
    amount?: number
  }[]
  taxMetadata?: AccountPayableTaxMetadata
}
