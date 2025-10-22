import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { IChurchRepository } from "@/Church/domain"
import { FindChurchById } from "@/Church/applications"
import { BaseReportRequest } from "../domain"
import {
  IncomeStatementCategoryBreakdown,
  IncomeStatementResponse,
} from "../domain/responses/IncomeStatement.response"
import { Logger } from "@/Shared/adapter"
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
      StatementCategory.CAPEX,
      StatementCategory.OTHER,
    ]

    const breakdownMap = new Map<
      StatementCategory,
      IncomeStatementCategoryBreakdown
    >()

    for (const category of orderedCategories) {
      breakdownMap.set(category, {
        category,
        income: 0,
        expenses: 0,
        net: 0,
      })
    }

    for (const summary of statementByCategory) {
      const current =
        breakdownMap.get(summary.category) ??
        ({
          category: summary.category,
          income: 0,
          expenses: 0,
          net: 0,
        } as IncomeStatementCategoryBreakdown)

      current.income = summary.income
      current.expenses = summary.expenses
      current.net = summary.income - summary.expenses
      breakdownMap.set(summary.category, current)
    }

    const breakdown: IncomeStatementCategoryBreakdown[] = [
      ...orderedCategories
        .map((category) => breakdownMap.get(category)!)
        .filter(Boolean),
      ...Array.from(breakdownMap.entries())
        .filter(([category]) => !orderedCategories.includes(category))
        .map(([, value]) => value),
    ]

    const revenue = breakdownMap.get(StatementCategory.REVENUE) ?? {
      category: StatementCategory.REVENUE,
      income: 0,
      expenses: 0,
      net: 0,
    }
    const cogs = breakdownMap.get(StatementCategory.COGS) ?? {
      category: StatementCategory.COGS,
      income: 0,
      expenses: 0,
      net: 0,
    }
    const opex = breakdownMap.get(StatementCategory.OPEX) ?? {
      category: StatementCategory.OPEX,
      income: 0,
      expenses: 0,
      net: 0,
    }
    const capex = breakdownMap.get(StatementCategory.CAPEX) ?? {
      category: StatementCategory.CAPEX,
      income: 0,
      expenses: 0,
      net: 0,
    }
    const other = breakdownMap.get(StatementCategory.OTHER) ?? {
      category: StatementCategory.OTHER,
      income: 0,
      expenses: 0,
      net: 0,
    }

    const grossProfit = revenue.net + cogs.net
    const operatingIncome = grossProfit + opex.net
    const otherNet = other.net
    const netIncome = operatingIncome + capex.net + otherNet

    return {
      period: {
        year: params.year,
        month: params.month,
      },
      breakdown,
      summary: {
        revenue: revenue.net,
        cogs: cogs.expenses - cogs.income,
        grossProfit,
        operatingExpenses: opex.expenses - opex.income,
        operatingIncome,
        capitalExpenditures: capex.expenses - capex.income,
        otherIncome: other.income,
        otherExpenses: other.expenses,
        otherNet,
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
