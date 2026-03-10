export type InternalTransferRequest = {
  fromAvailabilityAccountId: string
  toAvailabilityAccountId: string
  amount: number
  date: Date
  description?: string
  churchId: string
  createdBy: string
}
