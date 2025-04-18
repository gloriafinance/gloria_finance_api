import { SupplierType } from "../enums/SupplierType"
import { Installments } from "@/Shared/domain"

export interface ICreateAccountPayable {
  supplier: {
    supplierId: string
    supplierType: SupplierType
    supplierDNI: string
    name: string
    phone: string
  }
  accountPayableId?: string
  churchId: string
  description: string
  amountTotal: number
  amountPaid?: number
  amountPending?: number
  installments?: Installments[]
}
