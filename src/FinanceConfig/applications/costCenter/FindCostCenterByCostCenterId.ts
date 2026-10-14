import { CostCenter, CostCenterNotFound } from "../../../Financial/domain"
import type { IFinancialConfigurationRepository } from "@/FinanceConfig/domain"

export class FindCostCenterByCostCenterId {
  constructor(
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository
  ) {}

  async execute(churchId: string, costCenterId: string): Promise<CostCenter> {
    const costCenter =
      await this.financialConfigurationRepository.findCostCenterByCostCenterId(
        costCenterId,
        churchId
      )

    if (!costCenter) {
      throw new CostCenterNotFound()
    }

    return costCenter
  }
}
