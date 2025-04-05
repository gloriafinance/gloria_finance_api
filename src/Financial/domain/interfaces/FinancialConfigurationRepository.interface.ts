import { CostCenter } from "../CostCenter"
import { Bank } from "../Bank"
import { FinancialConcept } from "@/Financial/domain"

export interface IFinancialConfigurationRepository {
  findBankByBankId(bankId: string): Promise<Bank>

  findCostCenterByCostCenterId(
    costCenterId: string,
    churchId: string
  ): Promise<CostCenter>

  upsertBank(bank: Bank): Promise<void>

  upsertCostCenter(costCenter: CostCenter): Promise<void>

  upsertFinancialConcept(concept: FinancialConcept): Promise<void>

  searchBanksByChurchId(churchId: string): Promise<Bank[]>

  searchCenterCostsByChurchId(churchId: string): Promise<CostCenter[]>
}
