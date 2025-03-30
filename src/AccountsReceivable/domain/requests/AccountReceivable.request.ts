import { DebtorType } from "@/AccountsReceivable/domain"

export type AccountReceivableRequest = {
  debtor: {
    debtorType: DebtorType
    debtorId?: string
    name: string
  }
  churchId: string
  description: string
  installments: {
    amount: number
    dueDate: Date
  }[]
}
