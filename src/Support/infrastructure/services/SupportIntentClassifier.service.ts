import { GenericException } from "@/Shared/domain"
import type { SupportAnalysisTarget } from "@/Support/domain/requests/SupportAssistant.request"
import type { SupportAssistantIntent } from "@/Support/domain/types/SupportAssistant.response"

type ClassifyIntentParams = {
  question: string
  hasFiles: boolean
  hasAnalysisTarget: boolean
  analysisTarget?: SupportAnalysisTarget
}

export class SupportIntentClassifierService {
  classify(params: ClassifyIntentParams): SupportAssistantIntent {
    const question = params.question.trim()
    if (!question) {
      throw new GenericException("Field `question` is required")
    }

    const normalized = this.normalize(question)
    const normalizedAnalysisContext = this.normalizeAnalysisContext(
      params.analysisTarget
    )
    const combined = `${normalized} ${normalizedAnalysisContext}`.trim()
    const requestsAnalysis = this.requestsAnalysis(normalized)

    if (requestsAnalysis && !params.hasFiles && !params.hasAnalysisTarget) {
      throw new GenericException(
        "La solicitud pide analisis, pero no se adjunto ningun archivo ni datos para analizar."
      )
    }

    if (params.hasFiles) {
      return "document_guidance"
    }

    if (requestsAnalysis && params.hasAnalysisTarget) {
      return "report_analysis"
    }

    if (
      this.matchesAny(combined, [
        "que es gloria finance",
        "qué es gloria finance",
        "what is gloria finance",
        "o que e gloria finance",
        "o que é gloria finance",
        "que puedo hacer",
        "what can i do",
        "o que posso fazer",
      ])
    ) {
      return "product_overview"
    }

    if (
      this.matchesAny(combined, [
        "registrar gasto",
        "registrar ingreso",
        "registrar contribucion",
        "registrar contribución",
        "registrar contribuicao",
        "registrar contribuição",
        "registrar saida",
        "registrar saída",
        "registrar entrada",
        "como registrar",
        "como lancar",
        "como lançar",
        "financial record",
        "contribucion",
        "contribución",
        "contribuicao",
        "contribuição",
        "ofrenda",
        "oferta",
        "donacion",
        "donación",
        "doacao",
        "doação",
        "diezmo",
        "dizimo",
        "dízimo",
        "primicia",
        "primícia",
        "firstfruits",
        "cuentas por pagar",
        "contas a pagar",
        "cuentas por cobrar",
        "contas a receber",
        "benevolencia",
        "benevolencia",
        "benevolence",
        "benevolencia a una familia",
        "benevolencia a una persona",
        "benevolencia para una familia",
        "ajuda social",
        "asistencia social",
        "predicador invitado",
        "pregador convidado",
        "musico invitado",
        "músico convidado",
        "guest preacher",
        "guest musician",
        "prestamo",
        "préstamo",
        "emprestimo",
        "empréstimo",
        "pago parcial",
        "pagamento parcial",
        "partial payment",
        "concepto",
        "conceito",
      ])
    ) {
      return "register_financial_movement"
    }

    if (
      this.matchesAny(combined, [
        "configurar",
        "configuracion",
        "configuração",
        "financial concept",
        "financial concepts",
        "financial-concepts",
        "cost center",
        "cost-center",
        "centro de costo",
        "centro de custo",
        "availability account",
        "availability-accounts",
        "cuenta de disponibilidad",
        "conta de disponibilidade",
        "mes cerrado",
        "mês fechado",
        "closed month",
        "financial month",
        "mes financiero",
        "mês financeiro",
      ])
    ) {
      return "configuration_help"
    }

    if (
      this.matchesAny(combined, [
        "reporte",
        "report",
        "relatorio",
        "relatório",
        "dre",
        "income statement",
        "monthly tithes",
      ])
    ) {
      return "navigation_help"
    }

    return "general_support"
  }

  private requestsAnalysis(normalized: string): boolean {
    return this.matchesAny(normalized, [
      "analiza",
      "analise",
      "analyze",
      "analyse",
      "analizar",
      "analisar",
      "interpret",
      "interpreta",
      "revisa",
      "review",
      "explica este",
      "explain this",
    ])
  }

  private matchesAny(normalized: string, patterns: string[]): boolean {
    return patterns.some((pattern) => normalized.includes(pattern))
  }

  private normalize(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  }

  private normalizeAnalysisContext(target?: SupportAnalysisTarget): string {
    if (!target) return ""

    const parts = [target.title]
    if (typeof target.data === "string") {
      parts.push(target.data)
    } else {
      parts.push(JSON.stringify(target.data))
    }

    return this.normalize(parts.join(" "))
  }
}
