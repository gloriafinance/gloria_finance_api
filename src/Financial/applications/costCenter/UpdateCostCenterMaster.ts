import {
  ICostCenterMasterRepository,
  IFinancialConfigurationRepository,
} from "../../domain/interfaces"

import { CostCenter, CostCenterMaster } from "../../domain"
import MasterBalanceIdentifier from "../helpers/MasterBalanceIdentifier"
import { IQueue } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"

export class UpdateCostCenterMaster implements IQueue {
  private logger = Logger("UpdateCostCenterMaster")

  constructor(
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
    private readonly costCenterMasterRepository: ICostCenterMasterRepository
  ) {}

  async handle(args: {
    churchId: string
    costCenterId: string
    amount: number
  }) {
    const { churchId, costCenterId, amount } = args

    this.logger.info(`UpdateCostCenterMaster`, {
      churchId,
      costCenterId,
      amount,
    })

    const identify = MasterBalanceIdentifier(costCenterId)

    const costCenter: CostCenter =
      await this.financialConfigurationRepository.findCostCenterByCostCenterId(
        costCenterId,
        churchId
      )

    let costCenterMaster = await this.costCenterMasterRepository.one(identify)

    if (!costCenterMaster) {
      costCenterMaster = CostCenterMaster.create(costCenter)
    }

    costCenterMaster.updateMaster(amount)

    await this.costCenterMasterRepository.upsert(costCenterMaster)

    this.logger.info(`UpdateCostCenterMaster finish`, costCenterMaster)
  }
}
