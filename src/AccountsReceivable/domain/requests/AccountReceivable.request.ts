import { AccountReceivableType, DebtorType } from "@/AccountsReceivable/domain"
import { Church } from "@/Church/domain"

export type AccountReceivableRequest = {
  church: Church
  debtor: {
    debtorType: DebtorType
    debtorDNI: string
    name: string
    phone: string
    email: string
    address: string
  }
  churchId: string
  description: string
  installments: {
    amount: number
    dueDate: Date
  }[]
  type: AccountReceivableType
  financialConceptId: string
  createdBy: string
  symbol: string
  availabilityAccountId: string
}
