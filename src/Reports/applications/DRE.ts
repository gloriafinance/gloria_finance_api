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

    // consolida por categoria contábil (REVENUE, OPEX, CAPEX, etc.)
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
      // income / expenses já vêm agregados por categoria
      // reversals já foram tratados na IncomeStatement (não vamos subtrair 2x aqui)
      const income = summary.income ?? 0
      const expenses = summary.expenses ?? 0
      const net = income - expenses

      switch (summary.category) {
        case StatementCategory.REVENUE:
          // receitas operacionais (dízimos, ofertas, doações)
          receitaBruta += net
          break

        case StatementCategory.COGS:
          // custos diretos (se a igreja usar essa categoria)
          // guardamos como valor positivo de custo
          custosDiretos += expenses - income
          break

        case StatementCategory.OPEX:
          // despesas administrativas e operacionais
          despesasOperacionais += expenses - income
          break

        case StatementCategory.MINISTRY_TRANSFERS:
          // repasses para campo, convenção, missões, etc.
          repassesMinisteriais += expenses - income
          break

        case StatementCategory.CAPEX:
          // investimentos em mobiliário, equipamentos, etc.
          // não entram no resultado operacional, mas serão abatidos
          // ao calcular o resultado líquido final
          investimentosCAPEX += expenses
          break

        case StatementCategory.OTHER:
          // receitas e despesas não operacionais / extraordinárias
          resultadosExtraordinarios += net
          break

        default:
          // qualquer categoria desconhecida cai em "outros resultados"
          resultadosExtraordinarios += net
          break
      }
    }

    // montagem da DRE em etapas
    const receitaLiquida = receitaBruta
    const resultadoBruto = receitaLiquida - custosDiretos

    // resultado operacional antes de CAPEX e resultados extraordinários
    const resultadoOperacional =
      resultadoBruto - despesasOperacionais - repassesMinisteriais

    // >>>> PONTO CRÍTICO: unificamos com o Estado de Ingressos
    // Resultado líquido após:
    // - despesas operacionais
    // - repasses ministeriais
    // - resultados extraordinários
    // - investimentos CAPEX (cadeiras, mobiliário, etc.)
    const resultadoLiquido =
      resultadoOperacional + resultadosExtraordinarios - investimentosCAPEX

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
