import { InstallmentStatus } from "../enums/InstallmentStatus"

export type Installment = {
  installmentId?: string
  amount: number
  amountPaid?: number
  amountPending?: number
  dueDate: Date
  paymentDate?: Date
  status?: InstallmentStatus
  financialTransactionId?: string
}
