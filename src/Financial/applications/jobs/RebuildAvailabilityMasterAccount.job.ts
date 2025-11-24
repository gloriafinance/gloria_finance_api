import { IAvailabilityAccountMasterRepository } from "@/Financial/domain/interfaces"
import { IQueue } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"

export class RebuildAvailabilityMasterAccountJob implements IQueue {
  private logger = Logger(RebuildAvailabilityMasterAccountJob.name)

  constructor(
    private readonly availabilityAccountMasterRepository: IAvailabilityAccountMasterRepository
  ) {}

  async handle(args: {
    churchId: string
    year: number
    month: number
  }): Promise<any> {
    this.logger.info(
      `Rebuilt availability master account for church ${args.churchId} for ${args.month}/${args.year}`
    )

    await this.availabilityAccountMasterRepository.rebuildAvailabilityAccountsMaster(
      args
    )

    this.logger.info(`Rebuild completed successfully.`)
  }
}
