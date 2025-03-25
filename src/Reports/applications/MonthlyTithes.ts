import { IFinancialRecordRepository } from "../../Financial/domain/interfaces"
import { IChurchRepository } from "../../Church/domain"
import { FindChurchById } from "../../Church/applications"
import { BaseReportRequest } from "../domain"
import { Logger } from "../../Shared/adapter"

export class MonthlyTithes {
  private logger = Logger("MonthlyTithes")

  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(params: BaseReportRequest) {
    this.logger.info(`MonthlyTithes Report`, params)

    await new FindChurchById(this.churchRepository).execute(params.churchId)

    return await this.financialRecordRepository.titheList(params)
  }
}
