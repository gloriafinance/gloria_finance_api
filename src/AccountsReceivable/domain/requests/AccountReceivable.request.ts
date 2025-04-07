import { DebtorType } from "@/AccountsReceivable/domain"

export type AccountReceivableRequest = {
  debtor: {
    debtorType: DebtorType
    debtorDNI?: string
    name: string
  }
  churchId: string
  description: string
  installments: {
    amount: number
    dueDate: Date
  }[]
}
