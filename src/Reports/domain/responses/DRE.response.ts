export type DREResponse = {
  grossRevenue: number //receitaBruta
  netRevenue: number //receitaLiquida
  directCosts: number //custosDiretos
  grossProfit: number //resultadoBruto
  operationalExpenses: number //despesasOperacionais
  ministryTransfers: number //repassesMinisteriais
  capexInvestments: number //investimentosCAPEX
  extraordinaryResults: number //resultadosExtraordinarios
  operationalResult: number //resultadoOperacional
  netResult: number //resultadoLiquido
  year?: number
  month?: number
}
