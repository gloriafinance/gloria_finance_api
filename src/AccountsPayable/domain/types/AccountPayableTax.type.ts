import { AccountPayableTaxStatus } from "../enums/AccountPayableTaxStatus.enum"

export type AccountPayableTax = {
  taxType: string
  percentage: number
  amount: number
  status?: AccountPayableTaxStatus
}

export type AccountPayableTaxInput = Omit<AccountPayableTax, "amount"> & {
  amount?: number
}

export type AccountPayableTaxMetadata = {
  status?: AccountPayableTaxStatus
  taxExempt?: boolean
  exemptionReason?: string
  cstCode?: string
  cfop?: string
  observation?: string
}
