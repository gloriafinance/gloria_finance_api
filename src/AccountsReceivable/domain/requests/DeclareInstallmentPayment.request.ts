export type DeclareInstallmentPaymentRequest = {
  accountReceivableId: string
  installmentId: string
  debtorDNI: string
  availabilityAccountId: string
  amount: number
  voucher?: string
  file?: any
  churchId: string
  createdBy: string
}
