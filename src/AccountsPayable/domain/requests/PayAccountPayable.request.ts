export type PayAccountPayableRequest = {
  accountPayableId: string
  costCenterId: string
  installmentId: string
  installmentIds: string[]
  availabilityAccountId: string
  //amount: AmountValue
  file?: any
  createdBy: string
}
