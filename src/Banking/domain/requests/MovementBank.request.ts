import { TypeBankingOperation } from "../enums/TypeBankingOperation.enum"

export type MovementBankRequest = {
  amount: number
  bankingOperation: TypeBankingOperation
  concept: string
  bankId: string
  createdAt?: Date
}
