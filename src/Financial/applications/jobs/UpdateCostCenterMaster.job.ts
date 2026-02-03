import type {
  ICostCenterMasterRepository,
  IFinancialConfigurationRepository,
} from "../../domain/interfaces"

import { CostCenter, CostCenterMaster } from "../../domain"
import MasterBalanceIdentifier from "../helpers/MasterBalanceIdentifier"
import type { IJob } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"

export type UpdateCostCenterMasterJobRequest = {
  churchId: string
  costCenterId: string
  amount: number
  operation?: "add" | "subtract"
  availabilityAccount: {
    availabilityAccountId: string
    accountName: string
    accountType: string
    symbol: string
  }
}

export class UpdateCostCenterMasterJob implements IJob {
  private logger = Logger("UpdateCostCenterMaster")

  constructor(
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
    private readonly costCenterMasterRepository: ICostCenterMasterRepository
  ) {}

  async handle(args: UpdateCostCenterMasterJobRequest) {
    const { churchId, costCenterId, amount, operation, availabilityAccount } =
      args

    this.logger.info(`UpdateCostCenterMaster`, {
      jobName: UpdateCostCenterMasterJob.name,
      churchId,
      costCenterId,
      amount,
    })

    const identify = `${MasterBalanceIdentifier(costCenterId)}-${availabilityAccount.symbol}`

    const costCenter: CostCenter =
      (await this.financialConfigurationRepository.findCostCenterByCostCenterId(
        costCenterId,
        churchId
      ))!

    let costCenterMaster =
      await this.costCenterMasterRepository.findById(identify)

    if (!costCenterMaster) {
      costCenterMaster = CostCenterMaster.create(
        costCenter,
        availabilityAccount.symbol
      )
    }

    costCenterMaster.updateMaster(amount, operation)

    await this.costCenterMasterRepository.upsert(costCenterMaster)

    this.logger.info(`UpdateCostCenterMaster finish`, {
      jobName: UpdateCostCenterMasterJob.name,
      churchId,
      costCenterId,
      balance: costCenterMaster?.toPrimitives?.(),
    })
  }
}
