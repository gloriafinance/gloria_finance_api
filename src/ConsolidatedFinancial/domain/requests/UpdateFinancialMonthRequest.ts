export enum ActionsFinancialMonth {
  CLOSE = "close",
  OPEN = "open",
}

export type UpdateFinancialMonthRequest = {
  action: ActionsFinancialMonth
  month: number
  churchId: string
  year: number
}
