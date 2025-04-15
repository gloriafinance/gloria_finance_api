import { ProviderType } from "../enums/ProviderType"
import { Installment } from "../types/Installment.type"

export interface ICreateAccountPayable {
  provider: {
    providerType: ProviderType
    providerId?: string
    name: string
    phone: string
  }
  accountPayableId?: string
  churchId: string
  description: string
  amountTotal: number
  amountPaid?: number
  amountPending?: number
  installments?: Installment[]
}
