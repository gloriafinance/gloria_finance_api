export type DeclareInstallmentPaymentRequest = {
  accountReceivableId: string
  installmentId: string
  memberId: string
  availabilityAccountId: string
  amount: number
  voucher?: string
  file: any
}
