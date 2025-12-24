import { ICostCenterMasterRepository } from "@/Financial/domain/interfaces"
import { IJob } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"

export class RebuildCostCenterMasterJob implements IJob {
  private logger = Logger(RebuildCostCenterMasterJob.name)

  constructor(
    private readonly costCenterMasterRepository: ICostCenterMasterRepository
  ) {}

  async handle(args: {
    churchId: string
    year: number
    month: number
  }): Promise<any> {
    this.logger.info(`Rebuilt cost center master`, {
      jobName: RebuildCostCenterMasterJob.name,
      churchId: args.churchId,
      month: args.month,
      year: args.year,
    })

    await this.costCenterMasterRepository.rebuildCostCentersMaster(args)

    this.logger.info(`Rebuild completed successfully.`, {
      jobName: RebuildCostCenterMasterJob.name,
      churchId: args.churchId,
      month: args.month,
      year: args.year,
    })
  }
}
