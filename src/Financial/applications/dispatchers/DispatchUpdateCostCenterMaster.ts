import { Logger } from "@/Shared/adapter"
import { IQueueService, QueueName } from "@/Shared/domain"

export class DispatchUpdateCostCenterMaster {
  private logger = Logger(DispatchUpdateCostCenterMaster.name)

  constructor(private readonly queueService: IQueueService) {}

  execute(args: {
    churchId: string
    costCenterId: string
    amount: number
    operation?: "add" | "subtract"
  }) {
    this.logger.info(`DispatchUpdateCostCenterMaster`, args)

    this.queueService.dispatch(QueueName.UpdateCostCenterMaster, {
      churchId: args.churchId,
      amount: args.amount,
      costCenterId: args.costCenterId,
      operation: args.operation,
    })
  }
}
