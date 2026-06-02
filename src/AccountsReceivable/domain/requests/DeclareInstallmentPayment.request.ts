export type DeclareInstallmentPaymentRequest = {
  accountReceivableId: string
  installmentId: string
  memberId: string
  churchId: string
  availabilityAccountId: string
  amount: number
  voucher?: string
  file: any
}
