export enum StatementCategory {
  REVENUE = "REVENUE", // Entradas operacionais e doações recorrentes
  COGS = "COGS", // Custos diretos para entregar serviços ou projetos
  OPEX = "OPEX", // Despesas operacionais do dia a dia
  MINISTRY_TRANSFERS = "MINISTRY_TRANSFERS", // Repasses e contribuições ministeriais (ex.: dízimos de dízimos)
  CAPEX = "CAPEX", // Investimentos e gastos de capital de longo prazo
  OTHER = "OTHER", // Receitas ou despesas extraordinárias
}
