export type TrendValue = {
  current: number
  previous: number
}

export type TrendResponse = {
  period: {
    year: number
    month: number
  }
  trend: {
    revenue: TrendValue
    opex: TrendValue
    transfers: TrendValue
    capex: TrendValue
    netIncome: TrendValue
  }
}
