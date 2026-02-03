import type {
  IAvailabilityAccountMasterRepository,
  ICostCenterMasterRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import type { IChurchRepository } from "@/Church/domain"
import { FindChurchById } from "@/Church/applications"
import type { BaseReportRequest } from "../domain"
import type {
  IncomeStatementCategoryBreakdown,
  IncomeStatementResponse,
  IncomeStatementSymbolBreakdown,
  IncomeStatementSymbolSummary,
} from "@/Reports/domain"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { StatementCategory } from "@/Financial/domain"

export class IncomeStatement {
  private logger = Logger("IncomeStatement")

  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly costCenterMasterRepository: ICostCenterMasterRepository,
    private readonly availabilityAccountMasterRepository: IAvailabilityAccountMasterRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(params: BaseReportRequest): Promise<IncomeStatementResponse> {
    this.logger.info(`Starting the Income Statement Report`, params)

    await new FindChurchById(this.churchRepository).execute(params.churchId)

    const availableAccounts =
      await this.availabilityAccountMasterRepository.fetchAvailableAccounts(
        params
      )

    this.logger.info(`Calculating the total assets`)
    const availabilitySymbolTotals = new Map<
      string,
      { total: number; income: number; expenses: number }
    >()

    for (const availableAccount of availableAccounts) {
      const symbol =
        availableAccount.toPrimitives().availabilityAccount?.symbol ?? "R$"
      const current = availabilitySymbolTotals.get(symbol) ?? {
        total: 0,
        income: 0,
        expenses: 0,
      }

      current.total += availableAccount.getBalance()
      current.income += availableAccount.getIncome()
      current.expenses += availableAccount.getExpenses()
      availabilitySymbolTotals.set(symbol, current)
    }

    const costCenters =
      await this.costCenterMasterRepository.fetchCostCenters(params)

    this.logger.info(`Calculating the total liabilities`)
    const costCenterSymbolTotals = new Map<string, number>()
    for (const costCenter of costCenters) {
      const symbol = costCenter.toPrimitives().symbol ?? "R$"
      const current = costCenterSymbolTotals.get(symbol) ?? 0
      costCenterSymbolTotals.set(symbol, current + costCenter.getTotal())
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

    const symbolCategoryBreakdowns = new Map<
      string,
      Map<
        StatementCategory,
        IncomeStatementCategoryBreakdown & { reversal: number }
      >
    >()
    const symbolTotalsMap = new Map<
      string,
      { income: number; expenses: number; reversal: number }
    >()

    for (const summary of statementByCategory) {
      const summaryIncome = (summary.income ?? 0) - (summary.reversal ?? 0)
      const summaryExpenses = summary.expenses ?? 0
      const summaryReversal = summary.reversal ?? 0

      const symbol = summary.symbol ?? "R$"
      const symbolBreakdown = symbolCategoryBreakdowns.get(symbol) ?? new Map()
      const symbolCategory = symbolBreakdown.get(summary.category) ?? {
        category: summary.category,
        income: 0,
        expenses: 0,
        net: 0,
        reversal: 0,
      }

      symbolCategory.income += summaryIncome
      symbolCategory.expenses += summaryExpenses
      symbolCategory.reversal += summaryReversal
      symbolCategory.net = symbolCategory.income - symbolCategory.expenses
      symbolBreakdown.set(summary.category, symbolCategory)
      symbolCategoryBreakdowns.set(symbol, symbolBreakdown)

      const symbolTotals = symbolTotalsMap.get(symbol) ?? {
        income: 0,
        expenses: 0,
        reversal: 0,
      }

      symbolTotals.income += summaryIncome
      symbolTotals.expenses += summaryExpenses
      symbolTotals.reversal += summaryReversal
      symbolTotalsMap.set(symbol, symbolTotals)
    }

    const isDefined = <T>(value: T | undefined): value is T =>
      value !== undefined

    const breakdown: IncomeStatementSymbolBreakdown[] = Array.from(
      symbolCategoryBreakdowns.entries()
    ).map(([symbol, symbolMap]) => {
      const categories: IncomeStatementCategoryBreakdown[] = [
        ...orderedCategories
          .map((category) => symbolMap.get(category))
          .filter(isDefined)
          .map(({ category, income, expenses, net }) => ({
            category,
            income,
            expenses,
            net,
          })),
        ...Array.from(symbolMap.entries())
          .filter(([category]) => !orderedCategories.includes(category))
          .map(([, value]) => ({
            category: value.category,
            income: value.income,
            expenses: value.expenses,
            net: value.net,
          })),
      ]

      return {
        symbol,
        breakdown: categories,
      }
    })

    const summary: IncomeStatementSymbolSummary[] = Array.from(
      symbolTotalsMap.entries()
    ).map(([symbol, totals]) => {
      const income = totals.income
      const expenses = totals.expenses
      const net = income - expenses

      return {
        symbol,
        summary: {
          revenue: income,
          cogs: 0,
          grossProfit: net,
          operatingExpenses: expenses,
          operatingIncome: net,
          capitalExpenditures: 0,
          otherIncome: 0,
          otherExpenses: 0,
          otherNet: 0,
          reversalAdjustments: totals.reversal,
          totalIncome: income,
          totalExpenses: expenses,
          netIncome: net,
        },
      }
    })

    const availabilitySymbolTotalsList = Array.from(
      availabilitySymbolTotals.entries()
    ).map(([symbol, totals]) => ({
      symbol,
      total: totals.total,
      income: totals.income,
      expenses: totals.expenses,
    }))

    return {
      period: {
        year: params.year,
        month: params.month,
      },
      summary,
      breakdown,
      cashFlowSnapshot: {
        availabilityAccounts: {
          accounts: availableAccounts,
          totals: availabilitySymbolTotalsList,
        },
        costCenters: {
          costCenters: costCenters,
          totals: Array.from(costCenterSymbolTotals.entries()).map(
            ([symbol, total]) => ({ symbol, total })
          ),
        },
      },
    }
  }
}
