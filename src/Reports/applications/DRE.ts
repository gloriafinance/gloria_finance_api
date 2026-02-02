import { type IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { type IChurchRepository } from "@/Church/domain"
import { FindChurchById } from "@/Church/applications"
import type { BaseReportRequest } from "../domain"
import { DREMaster, type DREResponse, type IDRERepository } from "@/Reports/domain"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { StatementCategory } from "@/Financial/domain"

export class DRE {
  private logger = Logger("DRE")

  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly DRERepository: IDRERepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(
    params: BaseReportRequest & { month: number }
  ): Promise<DREResponse> {
    this.logger.info(`Starting DRE Report`, params)

    let dre = await this.DRERepository.one({ ...params })

    if (dre) {
      this.logger.info(`DRE Report found in repository`, params)
      return dre.toResponseAPI()
    }

    await new FindChurchById(this.churchRepository).execute(params.churchId)

    dre = await this.generateDRE(params)

    return dre.toResponseAPI()
  }

  async generateDRE(params: BaseReportRequest): Promise<DREMaster> {
    // consolidates by accounting category (REVENUE, OPEX, CAPEX, etc.)
    const statementByCategory =
      await this.financialRecordRepository.fetchStatementCategories(params)

    this.logger.info(
      `Statement categories fetched: ${JSON.stringify(statementByCategory)}`
    )

    let grossRevenue = 0
    let directCosts = 0
    let operationalExpenses = 0
    let ministryTransfers = 0
    let extraordinaryResults = 0
    let capexInvestments = 0

    for (const summary of statementByCategory) {
      // income / expenses already aggregated by category
      // reversals already handled in IncomeStatement (won't subtract twice here)
      const income = summary.income ?? 0
      const expenses = summary.expenses ?? 0
      const net = income - expenses

      switch (summary.category) {
        case StatementCategory.REVENUE:
          // operational revenues (tithes, offerings, donations)
          grossRevenue += net
          break

        case StatementCategory.COGS:
          // direct costs (if the church uses this category)
          // stored as positive cost value
          directCosts += expenses - income
          break

        case StatementCategory.OPEX:
          // administrative and operational expenses
          operationalExpenses += expenses - income
          break

        case StatementCategory.MINISTRY_TRANSFERS:
          // transfers to field, convention, missions, etc.
          ministryTransfers += expenses - income
          break

        case StatementCategory.CAPEX:
          // investments in furniture, equipment, etc.
          // not included in operational result, but will be deducted
          // when calculating final net result
          capexInvestments += expenses
          break

        case StatementCategory.OTHER:
          // non-operational / extraordinary revenues and expenses
          extraordinaryResults += net
          break

        default:
          // any unknown category falls into "other results"
          extraordinaryResults += net
          break
      }
    }

    // DRE assembly in stages
    const netRevenue = grossRevenue
    const grossProfit = netRevenue - directCosts

    // operational result before CAPEX and extraordinary results
    const operationalResult =
      grossProfit - operationalExpenses - ministryTransfers

    // >>>> CRITICAL POINT: unified with Income Statement
    // Net result after:
    // - operational expenses
    // - ministry transfers
    // - extraordinary results
    // - CAPEX investments (chairs, furniture, etc.)
    const netResult =
      operationalResult + extraordinaryResults - capexInvestments

    return DREMaster.create({
      churchId: params.churchId,
      month: params.month!,
      year: params.year,
      dre: {
        grossRevenue,
        netRevenue,
        directCosts,
        grossProfit,
        operationalExpenses,
        ministryTransfers,
        capexInvestments,
        extraordinaryResults,
        operationalResult,
        netResult,
      },
    })
  }

  async generateAndSaveDRE(params: BaseReportRequest): Promise<void> {
    this.logger.info(`Generating and saving DRE Report`, params)

    const dre = await this.generateDRE(params)

    await this.DRERepository.upsert(dre)
    this.logger.info(`DRE Report saved`)
  }
}
