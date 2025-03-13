import { AccountType } from "../enums/AccountType.enum"

export type AvailabilityAccountRequest = {
  availabilityAccountId?: string
  balance?: number
  churchId: string
  accountName: string
  active: boolean
  accountType: AccountType
  source?: any
  symbol: string
}
