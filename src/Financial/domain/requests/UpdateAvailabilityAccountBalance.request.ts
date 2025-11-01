import { TypeOperationMoney } from "@/Financial/domain"

export type UpdateAvailabilityAccountBalanceRequest = {
  availabilityAccountId: string
  amount: number
  operationType: TypeOperationMoney
  period: { year?: number; month?: number }
}
