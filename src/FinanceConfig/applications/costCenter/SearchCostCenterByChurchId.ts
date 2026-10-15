import { CostCenter } from "../../../Financial/domain"
import type { IFinancialConfigurationRepository } from "@/FinanceConfig/domain"

export class SearchCostCenterByChurchId {
  constructor(
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository
  ) {}

  async execute(churchId: string): Promise<CostCenter[]> {
    return await this.financialConfigurationRepository.searchCenterCostsByChurchId(
      churchId
    )
  }
}
