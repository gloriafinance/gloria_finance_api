import { IFinancialRecordRepository } from "../../Financial/domain/interfaces"
import { IChurchRepository } from "../../Church/domain"
import { FindChurchById } from "../../Church/applications"
import { BaseReportRequest } from "../domain"
import { IncomeStatementResponse } from "../domain/responses/IncomeStatement.response"
import { Logger } from "../../Shared/adapter"

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

    return {
      result: totalAssetIncome - liabilitiesAssets,
      assets: {
        accounts: availableAccounts,
        total: totalAssets,
        totalAssetIncome,
        totalAssetExpenses,
      },
      liabilities: {
        costCenters: costCenters,
        total: liabilitiesAssets,
      },
    }
  }
}
