import { InstallmentsStatus } from "@/AccountsReceivable/domain"

export type Installments = {
  installmentId?: string
  amount: number
  dueDate: Date
  paymentDate?: Date
  status?: InstallmentsStatus
  financialTransactionId?: string
}
