import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { IChurchRepository } from "@/Church/domain"
import { FindChurchById } from "@/Church/applications"
import { BaseReportRequest } from "../domain"
import {
  IncomeStatementCategoryBreakdown,
  IncomeStatementResponse,
} from "../domain/responses/IncomeStatement.response"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { StatementCategory } from "@/Financial/domain"

export class IncomeStatement {
  private logger = Logger("IncomeStatement")

  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(params: BaseReportRequest): Promise<IncomeStatementResponse> {
    this.logger.info(`Starting the Income Statement Report`, params)

    await new FindChurchById(this.churchRepository).execute(params.churchId)

    const availableAccounts =
      await this.financialRecordRepository.fetchAvailableAccounts(params)

    this.logger.info(`Calculating the total assets`)
    let totalAssets = 0
    let totalAssetIncome = 0
    let totalAssetExpenses = 0

    for (const availableAccount of availableAccounts) {
      totalAssets += availableAccount.getBalance()
      totalAssetIncome += availableAccount.getIncome()
      totalAssetExpenses += availableAccount.getExpenses()
    }

    const costCenters =
      await this.financialRecordRepository.fetchCostCenters(params)

    this.logger.info(`Calculating the total liabilities`)
    let liabilitiesAssets = 0
    for (const costCenter of costCenters) {
      liabilitiesAssets += costCenter.getTotal()
    }

    const statementByCategory =
      await this.financialRecordRepository.fetchStatementCategories(params)

    const orderedCategories: StatementCategory[] = [
      StatementCategory.REVENUE,
      StatementCategory.COGS,
      StatementCategory.OPEX,
      StatementCategory.MINISTRY_TRANSFERS,
      StatementCategory.CAPEX,
      StatementCategory.OTHER,
    ]

    const breakdownMap = new Map<
      StatementCategory,
      IncomeStatementCategoryBreakdown & { reversal: number }
    >()

    for (const category of orderedCategories) {
      breakdownMap.set(category, {
        category,
        income: 0,
        expenses: 0,
        net: 0,
        reversal: 0,
      })
    }

    for (const summary of statementByCategory) {
      const current = breakdownMap.get(summary.category) ?? {
        category: summary.category,
        income: 0,
        expenses: 0,
        net: 0,
        reversal: 0,
      }

      current.income = (summary.income ?? 0) - (summary.reversal ?? 0)
      current.expenses = summary.expenses ?? 0
      current.reversal = summary.reversal ?? 0
      current.net = current.income - current.expenses
      breakdownMap.set(summary.category, current)
    }

    const breakdown: IncomeStatementCategoryBreakdown[] = [
      ...orderedCategories
        .map((category) => breakdownMap.get(category)!)
        .filter(Boolean)
        .map(({ category, income, expenses, net }) => ({
          category,
          income,
          expenses,
          net,
        })),
      ...Array.from(breakdownMap.entries())
        .filter(([category]) => !orderedCategories.includes(category))
        .map(([, value]) => ({
          category: value.category,
          income: value.income,
          expenses: value.expenses,
          net: value.income - value.expenses,
        })),
    ]

    const totals = Array.from(breakdownMap.values()).reduce(
      (acc, item) => {
        acc.income += item.income
        acc.expenses += item.expenses
        acc.reversal += item.reversal
        return acc
      },
      { income: 0, expenses: 0, reversal: 0 }
    )

    const revenueTotal = totals.income
    const operatingExpenses = totals.expenses
    const operatingIncome = revenueTotal - operatingExpenses
    const reversalAdjustments = totals.reversal
    const netIncome = operatingIncome

    return {
      period: {
        year: params.year,
        month: params.month,
      },
      breakdown,
      summary: {
        revenue: revenueTotal,
        cogs: 0,
        grossProfit: operatingIncome,
        operatingExpenses,
        operatingIncome,
        capitalExpenditures: 0,
        otherIncome: 0,
        otherExpenses: 0,
        otherNet: 0,
        reversalAdjustments,
        totalIncome: revenueTotal,
        totalExpenses: operatingExpenses,
        netIncome,
      },
      cashFlowSnapshot: {
        availabilityAccounts: {
          accounts: availableAccounts,
          total: totalAssets,
          income: totalAssetIncome,
          expenses: totalAssetExpenses,
        },
        costCenters: {
          costCenters: costCenters,
          total: liabilitiesAssets,
        },
      },
    }
  }
}
