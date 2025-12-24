import { IAvailabilityAccountMasterRepository } from "@/Financial/domain/interfaces"
import { IJob } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"

export class RebuildAvailabilityMasterAccountJob implements IJob {
  private logger = Logger(RebuildAvailabilityMasterAccountJob.name)

  constructor(
    private readonly availabilityAccountMasterRepository: IAvailabilityAccountMasterRepository
  ) {}

  async handle(args: {
    churchId: string
    year: number
    month: number
  }): Promise<any> {
    this.logger.info(`Rebuilt availability master account`, {
      jobName: RebuildAvailabilityMasterAccountJob.name,
      churchId: args.churchId,
      month: args.month,
      year: args.year,
    })

    await this.availabilityAccountMasterRepository.rebuildAvailabilityAccountsMaster(
      args
    )

    this.logger.info(`Rebuild completed successfully.`, {
      jobName: RebuildAvailabilityMasterAccountJob.name,
      churchId: args.churchId,
      month: args.month,
      year: args.year,
    })
  }
}
