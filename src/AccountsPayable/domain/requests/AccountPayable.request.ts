import { ProviderType } from "@/AccountsPayable/domain"

export type AccountPayableRequest = {
  provider: {
    providerType: ProviderType
    providerDNI: string
    name: string
    phone: string
  }
  churchId: string
  description: string
  installments: {
    amount: number
    dueDate: Date
  }[]
}
