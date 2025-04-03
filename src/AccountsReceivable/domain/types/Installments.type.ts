import { InstallmentsStatus } from "@/AccountsReceivable/domain"

export type Installments = {
  installmentId?: string
  amount: number
  amountPaid?: number
  amountPending?: number
  dueDate: Date
  paymentDate?: Date
  status?: InstallmentsStatus
  financialTransactionId?: string
}
