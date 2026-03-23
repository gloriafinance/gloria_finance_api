export type SupportAssistantIntent =
  | "product_overview"
  | "navigation_help"
  | "register_financial_movement"
  | "report_analysis"
  | "document_guidance"
  | "configuration_help"
  | "general_support"

export type SupportAssistantConfidence = "low" | "medium" | "high"

export type SupportAssistantResponse = {
  conversationId?: string
  answer: string
  intent: SupportAssistantIntent
  confidence: SupportAssistantConfidence
  recommendedRoute: string
  recommendedScreen: string
  recommendedConcept: {
    financialConceptId: string
    name: string
  }
  steps: string[]
  warnings: string[]
  extractedData: {
    documentType: string
    vendor: string
    amount: string
    currency: string
    documentDate: string
    summary: string
  }
  sources: string[]
}
