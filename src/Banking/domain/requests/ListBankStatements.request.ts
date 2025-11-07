type AuthenticatedUser = {
  churchId: string
  isSuperuser?: boolean
}

export type ListBankStatementsRequest = {
  bankId?: string
  status?: string
  month?: string | number
  year?: string | number
  dateFrom?: string
  dateTo?: string
  churchId: string
  page: number
  perPage: number
}
