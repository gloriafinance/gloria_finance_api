import { AccountsReceivableStatus } from "@/AccountsReceivable/domain"

export type FilterAccountReceivableRequest = {
  churchId: string
  startDate?: Date
  endDate?: Date
  status?: AccountsReceivableStatus
  page: number
  perPage: number
}
