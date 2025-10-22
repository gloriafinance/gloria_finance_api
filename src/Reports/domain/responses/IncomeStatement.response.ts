import {
  AvailabilityAccountMaster,
  CostCenterMaster,
  StatementCategory,
} from "../../../Financial/domain"

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
  netIncome: number
}

export type IncomeStatementCashFlowSnapshot = {
  availabilityAccounts: {
    accounts: AvailabilityAccountMaster[]
    total: number
    income: number
    expenses: number
  }
  costCenters: {
    costCenters: CostCenterMaster[]
    total: number
  }
}

export type IncomeStatementResponse = {
  period: {
    year: number
    month?: number
  }
  breakdown: IncomeStatementCategoryBreakdown[]
  summary: IncomeStatementSummary
  cashFlowSnapshot: IncomeStatementCashFlowSnapshot
}
