import { Logger } from "@/Shared/adapter"
import { type IQueueService, QueueName } from "@/Shared/domain"
import type { UpdateCostCenterMasterJobRequest } from "@/Financial/applications"

export class DispatchUpdateCostCenterMaster {
  private logger = Logger(DispatchUpdateCostCenterMaster.name)

  constructor(private readonly queueService: IQueueService) {}

  execute(args: UpdateCostCenterMasterJobRequest) {
    this.logger.info(`DispatchUpdateCostCenterMaster`, args)

    this.queueService.dispatch<UpdateCostCenterMasterJobRequest>(
      QueueName.UpdateCostCenterMasterJob,
      {
        churchId: args.churchId,
        amount: args.amount,
        costCenterId: args.costCenterId,
        operation: args.operation,
        availabilityAccount: args.availabilityAccount,
      }
    )
  }
}
