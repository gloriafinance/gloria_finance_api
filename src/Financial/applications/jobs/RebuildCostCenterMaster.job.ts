import { ICostCenterMasterRepository } from "@/Financial/domain/interfaces"
import { IQueue } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"

export class RebuildCostCenterMasterJob implements IQueue {
  private logger = Logger(RebuildCostCenterMasterJob.name)

  constructor(
    private readonly costCenterMasterRepository: ICostCenterMasterRepository
  ) {}

  async handle(args: {
    churchId: string
    year: number
    month: number
  }): Promise<any> {
    this.logger.info(
      `Rebuilt cost center master for church ${args.churchId} for ${args.month}/${args.year}`
    )

    await this.costCenterMasterRepository.rebuildCostCentersMaster(args)

    this.logger.info(`Rebuild completed successfully.`)
  }
}
