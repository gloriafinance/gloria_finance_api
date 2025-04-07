import { DebtorType } from "../enums/DebtorType.enum"
import { Installments } from "../types/Installments.type"

export interface ICreateAccountReceivable {
  debtor: {
    debtorType: DebtorType
    debtorDNI?: string
    name: string
  }
  accountReceivableId?: string
  churchId: string
  description: string
  amountTotal: number
  amountPaid?: number
  amountPending?: number
  installments?: Installments[]
}
