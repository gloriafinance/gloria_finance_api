import { CostCenter } from "../CostCenter"
import { FinancialConcept } from "@/Financial/domain"

export interface IFinancialConfigurationRepository {
  findCostCenterByCostCenterId(
    costCenterId: string,
    churchId: string
  ): Promise<CostCenter>

  upsertCostCenter(costCenter: CostCenter): Promise<void>

  upsertFinancialConcept(concept: FinancialConcept): Promise<void>

  searchCenterCostsByChurchId(churchId: string): Promise<CostCenter[]>
}
