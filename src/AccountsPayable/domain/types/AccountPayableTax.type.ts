export type AccountPayableTax = {
  taxType: string
  percentage: number
  amount: number
}

export type AccountPayableTaxInput = Omit<AccountPayableTax, "amount"> & {
  amount?: number
}

export type AccountPayableTaxStatus =
  | "TAXED"
  | "EXEMPT"
  | "SUBSTITUTION"
  | "NOT_APPLICABLE"

export type AccountPayableTaxMetadata = {
  status?: AccountPayableTaxStatus
  exemptionReason?: string
  cstCode?: string
  cfop?: string
  observation?: string
}
