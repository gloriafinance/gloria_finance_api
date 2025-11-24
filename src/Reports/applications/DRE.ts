import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { IChurchRepository } from "@/Church/domain"
import { FindChurchById } from "@/Church/applications"
import { BaseReportRequest } from "../domain"
import { DREResponse } from "../domain/responses/DRE.response"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { StatementCategory } from "@/Financial/domain"

export class DRE {
  private logger = Logger("DRE")

  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(params: BaseReportRequest): Promise<DREResponse> {
    this.logger.info(`Starting DRE Report`, params)

    await new FindChurchById(this.churchRepository).execute(params.churchId)

    const statementByCategory =
      await this.financialRecordRepository.fetchStatementCategories(params)

    this.logger.info(
      `Statement categories fetched: ${JSON.stringify(statementByCategory)}`
    )

    let receitaBruta = 0
    let custosDiretos = 0
    let despesasOperacionais = 0
    let repassesMinisteriais = 0
    let resultadosExtraordinarios = 0
    let investimentosCAPEX = 0

    for (const summary of statementByCategory) {
      // AQUÍ YA NO RESTAMOS REVERSAL OTRA VEZ
      const net = summary.income - summary.expenses

      switch (summary.category) {
        case StatementCategory.REVENUE:
          receitaBruta += net
          break

        case StatementCategory.COGS:
          custosDiretos += summary.expenses - summary.income
          break

        case StatementCategory.OPEX:
          despesasOperacionais += summary.expenses - summary.income
          break

        case StatementCategory.MINISTRY_TRANSFERS:
          repassesMinisteriais += summary.expenses - summary.income
          break

        case StatementCategory.CAPEX:
          // Não afeta resultado, mas deve aparecer no relatório
          investimentosCAPEX += summary.expenses
          break

        case StatementCategory.OTHER:
          resultadosExtraordinarios += net
          break

        default:
          resultadosExtraordinarios += net
          break
      }
    }

    const receitaLiquida = receitaBruta
    const resultadoBruto = receitaLiquida - custosDiretos
    const resultadoOperacional =
      resultadoBruto - despesasOperacionais - repassesMinisteriais
    const resultadoLiquido = resultadoOperacional + resultadosExtraordinarios

    return {
      receitaBruta,
      receitaLiquida,
      custosDiretos,
      resultadoBruto,
      despesasOperacionais,
      repassesMinisteriais,
      investimentosCAPEX,
      resultadosExtraordinarios,
      resultadoOperacional,
      resultadoLiquido,
      year: params.year,
      month: params.month,
    }
  }
}
