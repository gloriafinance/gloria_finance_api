export type PayAccountReceivableRequest = {
  accountReceivableId: string
  installmentId: string
  financialTransactionId: string
  availabilityAccountId: string
  churchId: string
  amount: number
  file?: any
  voucher?: string
}
