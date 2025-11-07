import { TypeBankAccount } from "@/Banking/domain"

export type BankRequest = {
  bankId?: string
  accountType: TypeBankAccount
  active: boolean
  name: string
  tag: string
  addressInstancePayment: string
  bankInstruction: any
  churchId: string
}
