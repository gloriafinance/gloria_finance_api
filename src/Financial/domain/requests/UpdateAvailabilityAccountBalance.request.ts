import { TypeOperationMoney } from "../enums/TypeOperationMoney.enum"

export type UpdateAvailabilityAccountBalanceRequest = {
  availabilityAccountId: string
  amount: number
  operationType: TypeOperationMoney
}
