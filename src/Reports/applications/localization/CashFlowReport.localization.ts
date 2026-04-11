import type {
  CashFlowGroupBy,
  CashFlowProjectionResult,
} from "@/Reports/domain"

type SupportedLocale = "pt-BR" | "es"

type CashFlowLocaleCatalog = {
  reportName: string
  projectionLabel: string
  messages: {
    noData: string
    projectionUnavailable: string
    projectionDegraded: string
  }
  groupBy: Record<CashFlowGroupBy, string>
  accountTypes: Record<string, string>
  projectionStatus: Record<CashFlowProjectionResult["status"], string>
  availabilityAccounts: {
    all: string
    selected: (count: number) => string
  }
}

const CATALOGS: Record<SupportedLocale, CashFlowLocaleCatalog> = {
  "pt-BR": {
    reportName: "Fluxo de Caixa (Direto)",
    projectionLabel: "Projeção base (estimativa por média móvel 3M)",
    messages: {
      noData: "Não há dados para os filtros selecionados.",
      projectionUnavailable:
        "Projeção indisponível por histórico insuficiente.",
      projectionDegraded:
        "Projeção calculada com menos de 3 meses de histórico.",
    },
    groupBy: {
      day: "Dia",
      week: "Semana",
      month: "Mês",
    },
    accountTypes: {
      BANK: "Banco",
      CASH: "Dinheiro",
      WALLET: "Carteira",
      INVESTMENT: "Investimento",
    },
    projectionStatus: {
      available: "Disponível",
      degraded: "Parcial",
      unavailable: "Indisponível",
    },
    availabilityAccounts: {
      all: "Todas as contas",
      selected: (count: number) => `${count} contas selecionadas`,
    },
  },
  es: {
    reportName: "Flujo de Caja (Directo)",
    projectionLabel: "Proyección base (estimación por media móvil 3M)",
    messages: {
      noData: "No hay datos para los filtros seleccionados.",
      projectionUnavailable:
        "Proyección indisponible por histórico insuficiente.",
      projectionDegraded:
        "Proyección calculada con menos de 3 meses de histórico.",
    },
    groupBy: {
      day: "Día",
      week: "Semana",
      month: "Mes",
    },
    accountTypes: {
      BANK: "Banco",
      CASH: "Dinero",
      WALLET: "Billetera",
      INVESTMENT: "Inversión",
    },
    projectionStatus: {
      available: "Disponible",
      degraded: "Parcial",
      unavailable: "No disponible",
    },
    availabilityAccounts: {
      all: "Todas las cuentas",
      selected: (count: number) => `${count} cuentas seleccionadas`,
    },
  },
}

export const normalizeCashFlowLocale = (value?: string): SupportedLocale => {
  if (!value) {
    return "pt-BR"
  }

  const normalized = value.replace("_", "-").trim().toLowerCase()
  if (normalized.startsWith("es")) {
    return "es"
  }

  return "pt-BR"
}

export const getCashFlowReportCatalog = (
  value?: string
): CashFlowLocaleCatalog => {
  return CATALOGS[normalizeCashFlowLocale(value)]
}
