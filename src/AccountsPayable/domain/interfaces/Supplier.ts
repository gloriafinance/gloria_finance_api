import { SupplierType } from "@/AccountsPayable/domain"

export interface ISupplier {
  churchId: string
  type: SupplierType

  dni: string
  name: string

  address: {
    street: string
    number: string
    city: string
    state: string
    zipCode: string
  }
  phone: string
  email?: string
}
