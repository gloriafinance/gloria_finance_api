import { AccountType } from "@/Financial/domain"

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
