import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import type { IChurchRepository } from "@/Church/domain"
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

    const startDate = new Date(Date.UTC(params.year, params.month! - 1, 1))
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

    const result = await this.financialRecordRepository.titheList(filters)

    const symbolTotalsMap = new Map<string, { total: number }>()

    for (const r of result.records) {
      const symbol = r.symbol ?? "R$"

      const total = symbolTotalsMap.get(symbol) ?? {
        total: 0,
      }

      total.total += r.amount

      symbolTotalsMap.set(symbol, total)
    }

    return {
      ...result,
      totals: Array.from(symbolTotalsMap.entries()).map(([symbol, total]) => {
        return {
          symbol,
          ...total,
        }
      }),
    }
  }
}
