import { FinanceRecord } from "../FinanceRecord"
import { Criteria, Paginate } from "../../../Shared/domain"
import { BaseReportRequest } from "../../../Reports/domain"
import { AvailabilityAccountMaster } from "../AvailabilityAccountMaster"
import { CostCenterMaster } from "../CostCenterMaster"

export interface IFinancialRecordRepository {
  upsert(financialRecord: FinanceRecord): Promise<void>

  fetch(criteria: Criteria): Promise<Paginate<FinanceRecord>>

  titheList(
    filter: BaseReportRequest
  ): Promise<{ total: number; tithesOfTithes: number; records: any[] }>

  fetchAvailableAccounts(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<AvailabilityAccountMaster[]>

  fetchCostCenters(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<CostCenterMaster[]>
}
