import { InstallmentsStatus } from "../enums/InstallmentsStatus.enum"

export type Installments = {
  installmentId?: string
  amount: number
  dueDate: Date
  paymentDate?: Date
  status?: InstallmentsStatus
  financialTransactionId?: string
}
