import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { IChurchRepository } from "@/Church/domain"
import { FindChurchById } from "@/Church/applications"
import type { BaseReportRequest } from "../domain"
import { Logger } from "@/Shared/adapter"
import { ConceptType } from "@/FinanceConfig/domain"

export class MonthlyTithes {
  private logger = Logger("MonthlyTithes")

  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(params: BaseReportRequest) {
    this.logger.info(`MonthlyTithes Report`, params)

    const church = await new FindChurchById(this.churchRepository).execute(
      params.churchId
    )

    const startDate = new Date(Date.UTC(params.year, params.month - 1, 1))
    const endDate = new Date(Date.UTC(params.year, params.month, 1))

    const filters = {
      churchId: church.getChurchId(),
      date: {
        $gte: startDate,
        $lt: endDate,
      },
      "financialConcept.name": {
        $regex: church.getLang() === "pt-BR" ? "Dízimos" : "Diezmos",
      },
      type: ConceptType.INCOME,
    }

    return await this.financialRecordRepository.titheList(filters)
  }
}
