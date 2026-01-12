import { Installments } from "@/Shared/domain"
import { SupplierType } from "../enums/SupplierType"
import {
  AccountPayableTaxInput,
  AccountPayableTaxMetadata,
  TaxDocumentType,
} from "@/AccountsPayable/domain"

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
  taxDocument: {
    type: TaxDocumentType
    number?: string
    date: Date
  }
  installments?: Installments[]
  taxes?: AccountPayableTaxInput[]
  taxAmountTotal?: number
  taxMetadata?: AccountPayableTaxMetadata
  createdBy: string
  symbol: string
}
