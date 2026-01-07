import { CostCenterMaster } from "@/Financial/domain"

export interface ICostCenterMasterRepository {
  findById(costCenterMasterId: string): Promise<CostCenterMaster | undefined>

  search(
    churchId: string,
    month: number,
    year: number
  ): Promise<CostCenterMaster[]>

  upsert(costCenterMaster: CostCenterMaster): Promise<void>

  rebuildCostCentersMaster(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<void>

  fetchCostCenters(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<CostCenterMaster[]>
}
