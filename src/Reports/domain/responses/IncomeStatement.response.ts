import {
  AvailabilityAccountMaster,
  CostCenterMaster,
} from "../../../Financial/domain"

export type IncomeStatementResponse = {
  assets: {
    accounts: AvailabilityAccountMaster[]
    total: number
    totalAssetIncome: number
    totalAssetExpenses: number
  }
  liabilities: {
    costCenters: CostCenterMaster[]
    total: number
  }
  result: number
}
