import {
  AvailabilityAccountMaster,
  CostCenterMaster,
  StatementCategory,
} from "@/Financial/domain"

export type IncomeStatementCategoryBreakdown = {
  category: StatementCategory
  income: number
  expenses: number
  net: number
}

export type IncomeStatementSummary = {
  revenue: number
  cogs: number
  grossProfit: number
  operatingExpenses: number
  operatingIncome: number
  capitalExpenditures: number
  otherIncome: number
  otherExpenses: number
  otherNet: number
  reversalAdjustments: number
  totalIncome: number
  totalExpenses: number
  netIncome: number
}

export type IncomeStatementSymbolSummary = {
  symbol: string
  summary: IncomeStatementSummary
}

export type IncomeStatementSymbolBreakdown = {
  symbol: string
  breakdown: IncomeStatementCategoryBreakdown[]
}

export type IncomeStatementAvailabilityAccountSymbolTotals = {
  symbol: string
  total: number
  income: number
  expenses: number
}

export type IncomeStatementCostCenterSymbolTotals = {
  symbol: string
  total: number
}

export type IncomeStatementCashFlowSnapshot = {
  availabilityAccounts: {
    accounts: AvailabilityAccountMaster[]
    totals: IncomeStatementAvailabilityAccountSymbolTotals[]
  }
  costCenters: {
    costCenters: CostCenterMaster[]
    totals: IncomeStatementCostCenterSymbolTotals[]
  }
}

export type IncomeStatementResponse = {
  period: {
    year: number
    month?: number
  }
  summary: IncomeStatementSymbolSummary[]
  breakdown: IncomeStatementSymbolBreakdown[]
  cashFlowSnapshot: IncomeStatementCashFlowSnapshot
}
