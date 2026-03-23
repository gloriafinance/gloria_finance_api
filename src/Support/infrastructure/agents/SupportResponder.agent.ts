import { FinancialConcept } from "@/FinanceConfig/domain"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError"
import { AITextService } from "@/package/ai/service/AITextService"
import { type Schema, SchemaType } from "@google/generative-ai"
import type { SupportAnalysisTarget } from "@/Support/domain/requests/SupportAssistant.request"
import type {
  SupportAssistantIntent,
  SupportAssistantResponse,
} from "@/Support/domain/types/SupportAssistant.response"
import type { SupportConversationHistoryEntry } from "@/Support/domain/types/SupportConversation.type"
import type { SupportVisionExtraction } from "@/Support/infrastructure/agents/SupportDocumentVision.agent"

type ExecuteSupportResponseParams = {
  question: string
  lang: string
  intent: SupportAssistantIntent
  churchId: string
  knowledgeContext: string
  analysisTarget?: SupportAnalysisTarget
  conversationHistory: SupportConversationHistoryEntry[]
  visualContext?: SupportVisionExtraction
  financialConcepts: FinancialConcept[]
  allowedSources: string[]
  allowedRoutes: string[]
  allowedScreens: string[]
}

const SUPPORT_INTENTS: SupportAssistantIntent[] = [
  "product_overview",
  "navigation_help",
  "register_financial_movement",
  "report_analysis",
  "document_guidance",
  "configuration_help",
  "general_support",
]

const SUPPORT_CONFIDENCE = ["low", "medium", "high"] as const

export class SupportResponderAgent {
  constructor(private readonly textService = AITextService.getInstance()) {}

  async execute(
    params: ExecuteSupportResponseParams
  ): Promise<SupportAssistantResponse> {
    const response = await this.textService.execute({
      systemPrompt: this.buildSystemPrompt(
        params.lang,
        params.allowedSources,
        params.allowedRoutes,
        params.allowedScreens,
        params.financialConcepts
      ),
      userPrompt: this.buildUserPrompt(params),
      schema: this.buildResponseSchema(),
      validate: (provider, payload) =>
        this.validateResponse(provider, payload, params),
    })

    if (params.visualContext) {
      response.extractedData = {
        documentType: params.visualContext.documentType,
        vendor: params.visualContext.vendor,
        amount: params.visualContext.amount,
        currency: params.visualContext.currency,
        documentDate: params.visualContext.documentDate,
        summary: params.visualContext.summary,
      }
    }

    return response
  }

  private buildResponseSchema(): Schema {
    return {
      type: SchemaType.OBJECT,
      properties: {
        answer: { type: SchemaType.STRING },
        intent: {
          type: SchemaType.STRING,
          format: "enum",
          enum: [...SUPPORT_INTENTS],
        },
        confidence: {
          type: SchemaType.STRING,
          format: "enum",
          enum: [...SUPPORT_CONFIDENCE],
        },
        recommendedRoute: { type: SchemaType.STRING },
        recommendedScreen: { type: SchemaType.STRING },
        recommendedConcept: {
          type: SchemaType.OBJECT,
          properties: {
            financialConceptId: { type: SchemaType.STRING },
            name: { type: SchemaType.STRING },
          },
          required: ["financialConceptId", "name"],
        },
        steps: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        warnings: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        extractedData: {
          type: SchemaType.OBJECT,
          properties: {
            documentType: { type: SchemaType.STRING },
            vendor: { type: SchemaType.STRING },
            amount: { type: SchemaType.STRING },
            currency: { type: SchemaType.STRING },
            documentDate: { type: SchemaType.STRING },
            summary: { type: SchemaType.STRING },
          },
          required: [
            "documentType",
            "vendor",
            "amount",
            "currency",
            "documentDate",
            "summary",
          ],
        },
        sources: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: [
        "answer",
        "intent",
        "confidence",
        "recommendedRoute",
        "recommendedScreen",
        "recommendedConcept",
        "steps",
        "warnings",
        "extractedData",
        "sources",
      ],
    }
  }

  private buildSystemPrompt(
    lang: string,
    allowedSources: string[],
    allowedRoutes: string[],
    allowedScreens: string[],
    financialConcepts: FinancialConcept[]
  ): string {
    return `
Eres Gloria Assistance, el asistente tecnico de Gloria Finance.

Debes ayudar a usuarios reales del sistema con funcionalidad, navegacion, configuracion, registro de movimientos y analisis de informacion adjunta.

Reglas:
- Responde solo con JSON valido.
- No inventes pantallas ni rutas.
- No inventes botones, campos, formularios, modulos ni pasos de UI que no aparezcan en las fuentes.
- Usa solo fuentes permitidas.
- Si falta contexto para afirmar algo con seguridad, dilo en warnings.
- Si recomiendas una pantalla, usa la ruta real.
- Si recomiendas un concepto financiero, prioriza conceptos existentes entregados en el contexto.
- Si no encuentras un concepto exacto dentro de los conceptos entregados, no asumas que existe.
- Responde en el idioma del usuario (${lang}).
- Usa un tono profesional, sereno y claro.
- Escribe de forma sencilla, con palabras faciles de entender por usuarios no tecnicos.
- Evita frases coloquiales, exageradas o demasiado informales.
- Evita sonar robotico o academico; explica como un asesor serio que sabe simplificar.
- Mantente practico: primero responde la duda, luego guia la accion concreta dentro del sistema.
- Cuando la intencion sea analitica, explica hallazgos y limites del analisis en lenguaje claro.
- Cuando la intencion sea operacional, prioriza pasos concretos y evita teoria innecesaria.

Fuentes permitidas:
${allowedSources.join(", ")}

Rutas permitidas:
${allowedRoutes.join(", ") || "(ninguna)"}

Pantallas permitidas:
${allowedScreens.join(", ") || "(ninguna)"}

Conceptos financieros permitidos:
${
  financialConcepts
    .map((concept) => `${concept.getFinancialConceptId()}:${concept.getName()}`)
    .join(", ") || "(ninguno)"
}
    `.trim()
  }

  private buildUserPrompt(params: ExecuteSupportResponseParams): string {
    const conceptsContext =
      params.financialConcepts.length === 0
        ? "No relevant financial concepts were matched."
        : params.financialConcepts
            .map((concept) =>
              JSON.stringify({
                sourceId: `concept:${concept.getFinancialConceptId()}`,
                financialConceptId: concept.getFinancialConceptId(),
                name: concept.getName(),
                description: concept.getDescription(),
                type: concept.getType(),
                statementCategory: concept.getStatementCategory(),
              })
            )
            .join("\n")

    return `
User language: ${params.lang}
ChurchId: ${params.churchId}
Detected intent: ${params.intent}
Question: ${params.question}

Knowledge base context:
${params.knowledgeContext}

Intent-specific guidance:
${this.buildIntentGuidance(params.intent)}

Relevant financial concepts:
${conceptsContext}

Conversation history:
${this.serializeConversationHistory(params.conversationHistory)}

Analysis target:
${this.serializeAnalysisTarget(params.analysisTarget)}

Structured report facts:
${this.buildReportStructuredFacts(params.analysisTarget)}

Visual extraction:
${params.visualContext ? JSON.stringify(params.visualContext) : "None"}

Response guidance:
- answer: professional, simple, useful and grounded explanation
- intent: keep detected intent unless the evidence clearly indicates document_guidance
- recommendedRoute: empty string if no screen should be opened
- recommendedScreen: human title of the suggested screen or empty string
- recommendedConcept: use existing concept when applicable, otherwise empty strings
- steps: 0 to 5 concrete steps
- warnings: 0 to 4 warnings
- extractedData: keep empty strings if there is no document/image data
- sources: only ids from the allowed list
- For report_analysis, prioritize interpretation over navigation. Explain what happened, what increased, what consumed more, what stands out, and what deserves follow-up.
- For report_analysis, write the answer as 2 to 4 short paragraphs in professional plain language, not as a technical dump of numbers.
- For report_analysis, avoid openings like "Entrou mais dinheiro..." or other overly colloquial phrasing. Prefer wording such as "En el periodo la iglesia cerró con superávit..." or equivalent in the user's language.
- For report_analysis, start with a concise executive summary, then explain what drove the result, and finally what deserves attention or follow-up.
- For report_analysis, say clearly where most money came in, where most money went out, and which cost center concentrated the most spending when that evidence exists.
- For report_analysis, prefer user-facing wording like "the main income came from...", "the biggest spending was in...", or "the cost center that spent the most was..." instead of internal accounting labels alone.
- For report_analysis, avoid percentages and accounting jargon unless they add clear value for an end user.
- For report_analysis, do not make speculative claims about a donor, family, accounting error or missing posting unless the payload explicitly supports that conclusion.
- For report_analysis, if the analysis already comes from a real report payload, keep recommendedRoute and recommendedScreen empty unless the user explicitly asks where to open it.
- If analysisTarget.type is "text" and it identifies a current route, screen or module, treat that as first-party contextual evidence from the current screen.
- If analysisTarget already identifies the current screen, do not say the screen is unknown or unavailable.
- If there is conversation history, continue from the previous turns instead of restarting from zero.
- If the new question is a refinement of the previous one, preserve that continuity.
- Report-specific focus:
${this.buildReportSpecificPrompt(params.analysisTarget)}
    `.trim()
  }

  private validateResponse(
    provider: string,
    payload: unknown,
    params: Pick<
      ExecuteSupportResponseParams,
      | "allowedSources"
      | "allowedRoutes"
      | "allowedScreens"
      | "financialConcepts"
    >
  ): SupportAssistantResponse {
    if (!payload || typeof payload !== "object") {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: payload is not an object"
      )
    }

    const response = payload as Record<string, unknown>
    const requiredKeys = [
      "answer",
      "intent",
      "confidence",
      "recommendedRoute",
      "recommendedScreen",
      "recommendedConcept",
      "steps",
      "warnings",
      "extractedData",
      "sources",
    ]

    if (!this.hasOnlyKeys(response, requiredKeys)) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: unexpected top-level keys"
      )
    }

    for (const key of [
      "answer",
      "intent",
      "confidence",
      "recommendedRoute",
      "recommendedScreen",
    ]) {
      if (typeof response[key] !== "string") {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          `Invalid support response: field '${key}' must be string`
        )
      }
    }

    if (!(SUPPORT_INTENTS as string[]).includes(response.intent as string)) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: unsupported intent"
      )
    }

    if (
      !(SUPPORT_CONFIDENCE as readonly string[]).includes(
        response.confidence as string
      )
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: unsupported confidence"
      )
    }

    const recommendedConcept = response.recommendedConcept
    if (!recommendedConcept || typeof recommendedConcept !== "object") {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: recommendedConcept must be object"
      )
    }

    const conceptRecord = recommendedConcept as Record<string, unknown>
    if (
      !this.hasOnlyKeys(conceptRecord, ["financialConceptId", "name"]) ||
      typeof conceptRecord.financialConceptId !== "string" ||
      typeof conceptRecord.name !== "string"
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: recommendedConcept shape is invalid"
      )
    }

    const extractedData = response.extractedData
    if (!extractedData || typeof extractedData !== "object") {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: extractedData must be object"
      )
    }

    const extractedRecord = extractedData as Record<string, unknown>
    const extractedKeys = [
      "documentType",
      "vendor",
      "amount",
      "currency",
      "documentDate",
      "summary",
    ]
    if (!this.hasOnlyKeys(extractedRecord, extractedKeys)) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: extractedData shape is invalid"
      )
    }

    for (const key of extractedKeys) {
      if (typeof extractedRecord[key] !== "string") {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          `Invalid support response: extractedData.${key} must be string`
        )
      }
    }

    if (
      !Array.isArray(response.steps) ||
      response.steps.some((item) => typeof item !== "string")
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: steps must be string array"
      )
    }

    if (
      !Array.isArray(response.warnings) ||
      response.warnings.some((item) => typeof item !== "string")
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: warnings must be string array"
      )
    }

    if (
      !Array.isArray(response.sources) ||
      response.sources.some((item) => typeof item !== "string")
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: sources must be string array"
      )
    }

    const invalidSource = (response.sources as string[]).find(
      (source) => !params.allowedSources.includes(source)
    )

    if (invalidSource) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        `Invalid support response: source '${invalidSource}' is not allowed`
      )
    }

    let recommendedRoute = response.recommendedRoute as string
    let recommendedScreen = response.recommendedScreen as string

    if (response.intent === "report_analysis") {
      recommendedRoute = ""
      recommendedScreen = ""
      response.recommendedRoute = recommendedRoute
      response.recommendedScreen = recommendedScreen
    }

    if (
      recommendedRoute.length > 0 &&
      !params.allowedRoutes.includes(recommendedRoute)
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        `Invalid support response: route '${recommendedRoute}' is not allowed`
      )
    }

    if (
      recommendedScreen.length > 0 &&
      !params.allowedScreens.includes(recommendedScreen)
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        `Invalid support response: screen '${recommendedScreen}' is not allowed`
      )
    }

    const recommendedConceptId = conceptRecord.financialConceptId
    const recommendedConceptName = conceptRecord.name
    if (
      (recommendedConceptId.length === 0) !==
      (recommendedConceptName.length === 0)
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid support response: recommendedConcept must be fully empty or fully defined"
      )
    }

    if (recommendedConceptId.length > 0) {
      const matchedConcept = params.financialConcepts.find(
        (concept) =>
          concept.getFinancialConceptId() === recommendedConceptId &&
          concept.getName() === recommendedConceptName
      )

      if (!matchedConcept) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          `Invalid support response: concept '${recommendedConceptId}' is not allowed`
        )
      }

      if (
        !(response.sources as string[]).includes(
          `concept:${recommendedConceptId}`
        )
      ) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          `Invalid support response: missing source for concept '${recommendedConceptId}'`
        )
      }
    }

    return response as SupportAssistantResponse
  }

  private hasOnlyKeys(obj: Record<string, unknown>, keys: string[]): boolean {
    const objKeys = Object.keys(obj).sort()
    const expected = [...keys].sort()
    return JSON.stringify(objKeys) === JSON.stringify(expected)
  }

  private serializeAnalysisTarget(
    analysisTarget?: SupportAnalysisTarget
  ): string {
    if (!analysisTarget) {
      return "None"
    }

    return JSON.stringify({
      type: analysisTarget.type,
      title: analysisTarget.title,
      data: analysisTarget.data,
    })
  }

  private serializeConversationHistory(
    history: SupportConversationHistoryEntry[]
  ): string {
    if (history.length === 0) {
      return "None"
    }

    return history
      .map((entry, index) =>
        JSON.stringify({
          turn: index + 1,
          question: entry.question,
          answer: entry.answer,
          intent: entry.intent,
          response: entry.response
            ? {
                recommendedRoute: entry.response.recommendedRoute,
                recommendedScreen: entry.response.recommendedScreen,
                recommendedConcept: entry.response.recommendedConcept,
                steps: entry.response.steps,
                warnings: entry.response.warnings,
              }
            : undefined,
          analysisTarget: entry.analysisTarget,
          attachments: entry.attachments?.map((attachment) => ({
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
          })),
          sources: entry.sources,
          createdAt: entry.createdAt,
        })
      )
      .join("\n")
  }

  private buildIntentGuidance(intent: SupportAssistantIntent): string {
    switch (intent) {
      case "product_overview":
        return [
          "- Explain what Gloria Finance is and what the user can do with it.",
          "- Mention the most relevant modules or capabilities grounded in sources.",
          "- recommendedRoute and recommendedScreen should usually stay empty unless the question asks where to start.",
          "- steps should be minimal and optional.",
        ].join("\n")
      case "navigation_help":
        return [
          "- Focus on where the user should go inside the product.",
          "- Prefer one concrete screen and route when the sources support it.",
          "- steps should describe navigation or UI actions, not accounting theory.",
        ].join("\n")
      case "register_financial_movement":
        return [
          "- Decide the most suitable flow for the movement: financial record, payable, receivable, purchase or another supported screen.",
          "- If analysisTarget describes the current screen, treat it as the screen where the user is currently working.",
          "- Prefer helping the user complete the flow in that current screen when the grounded evidence supports it.",
          "- If a financial concept from the provided list fits, recommend it explicitly.",
          "- If no exact concept from the provided list fits, keep recommendedConcept empty and tell the user to review the concepts list before creating a new one.",
          "- Do not mention fields that are not present in the grounded screen context.",
          "- Do not claim that the screen or route is unknown when analysisTarget already includes it.",
          "- steps should guide the registration sequence inside the system.",
          "- warnings should mention missing accounting context only when it materially changes the flow.",
        ].join("\n")
      case "report_analysis":
        return [
          "- Treat analysisTarget as the main evidence to analyze.",
          "- Summarize the report in a useful ministry and business way, highlighting interpretation, not just repeating raw data.",
          "- Start with an executive summary of the period: whether the church closed with surplus or deficit and the overall financial direction.",
          "- Then explain the main drivers of the result: where the strongest inflows came from, where the main outflows concentrated, and which cost center spent the most when that data exists.",
          "- After that, explain what deserves attention: negative balances, unusual concentration, inconsistencies, or expenses that are too high relative to income.",
          "- End with 1 to 3 concrete follow-up actions or checks that the church leadership should review.",
          "- Avoid telling the user to reopen the same report screen when the report payload is already provided.",
          "- Prefer professional plain-language insights such as 'the month closed with surplus', 'expenses were concentrated in administration', or 'one treasury ended the period with negative balance', instead of only listing totals.",
          "- Keep the language understandable for pastors, treasurers and administrative users, not only accountants.",
          "- Avoid sounding alarmist or speculative when the report only shows one period or partial evidence.",
          this.buildReportTypeGuidance(),
          "- If the data is incomplete, state that clearly in warnings.",
          "- recommendedRoute and recommendedScreen should usually stay empty.",
        ].join("\n")
      case "document_guidance":
        return [
          "- Treat visual extraction as primary evidence and combine it with system knowledge.",
          "- Explain how the user should register the document in Gloria Finance.",
          "- If the document suggests a concept or route, make the recommendation concrete.",
          "- Use warnings for ambiguity such as unpaid invoice vs already-paid expense.",
        ].join("\n")
      case "configuration_help":
        return [
          "- Focus on setup screens such as financial concepts, availability accounts, cost centers or similar configuration areas.",
          "- steps should explain the configuration workflow clearly.",
          "- Avoid generic product descriptions unless the user explicitly asks for them.",
        ].join("\n")
      case "general_support":
      default:
        return [
          "- Answer the question directly with grounded product guidance.",
          "- If there is a clearly relevant route, include it; otherwise leave route and screen empty.",
          "- Do not invent operational details when the context only supports a general answer.",
          "- Keep the response practical and concise.",
        ].join("\n")
    }
  }

  private buildReportTypeGuidance(): string {
    return [
      "- If reportType is 'income_statement', explain revenues, expense burden, net result, treasury balances, and cost-center concentration.",
      "- If reportType is 'dre', explain in simple language what came in, what went out, whether the month closed positively or negatively, and whether there was any extra non-recurring help in the final result.",
      "- If reportType is 'monthly_tithes', explain total tithes in the period, distribution by treasury/account, and any relevant concentration or missing pattern.",
    ].join("\n")
  }

  private buildReportSpecificPrompt(
    analysisTarget?: SupportAnalysisTarget
  ): string {
    if (
      !analysisTarget ||
      analysisTarget.type !== "report" ||
      !analysisTarget.data ||
      typeof analysisTarget.data !== "object"
    ) {
      return "- No specific report subtype guidance available."
    }

    const reportType = (analysisTarget.data as Record<string, unknown>)
      .reportType
    if (typeof reportType !== "string") {
      return "- No specific report subtype guidance available."
    }

    switch (reportType) {
      case "income_statement":
        return [
          "- For income_statement, answer in this order: 1) how the month closed, 2) what generated the main income, 3) where spending was concentrated, 4) what deserves treasury follow-up.",
          "- Mention clearly if the month closed with surplus or deficit and by how much.",
          "- Compare total income and total expenses in plain language.",
          "- State explicitly which category brought in the most money and which category consumed the most money.",
          "- If the data includes cost centers, name the cost center with the highest spending in simple language.",
          "- Call out treasury balances or negative account balances when present because they matter operationally.",
          "- If one cost center concentrates most spending, explain that concentration as a management point.",
          "- Do not focus on net-margin percentages unless the user explicitly asks for ratios.",
          "- If cost-center data comes from a broader treasury snapshot than the statement totals, present it as movement concentration, not as proof of inconsistency.",
        ].join("\n")
      case "dre":
        return [
          "- For dre, answer in this order: 1) how the month closed, 2) what was the main regular entry, 3) what was the main spending pressure, 4) whether an extra non-recurring entry changed the final result, 5) managerial follow-up.",
          "- Prefer simple terms such as regular income, month expenses, extra entry and final result.",
          "- Avoid leading with labels like operational result, net result or extraordinary result unless they are explained in plain language right after.",
          "- Make clear where most money came in and where most money went out with direct wording.",
          "- If an extra non-recurring entry improved the final result, explain that clearly without sounding too technical.",
          "- Do not use percentages unless they really help the user understand the month.",
        ].join("\n")
      case "monthly_tithes":
        return [
          "- For monthly_tithes, answer in this order: 1) total tithe behavior in the period, 2) how the amount was distributed, 3) any concentration or drop worth attention, 4) suggested follow-up.",
          "- Mention which treasury or account concentrated the most tithes and whether one single record stands out too much.",
          "- Use language that helps pastors and treasurers understand giving behavior, not just totals.",
          "- Do not infer that a concentration came from one donor or one family unless the report explicitly identifies that source.",
          "- Do not present concentration in one treasury as a problem by itself unless the report shows a negative operational impact or missing expected channels.",
          "- Do not suggest creating a new treasury or account as a default recommendation when the payload only shows that one treasury received the tithes.",
          "- Prefer cautious wording such as 'it is worth monitoring whether this pattern repeats' or 'it is worth confirming whether this distribution is the normal operating practice'.",
        ].join("\n")
      default:
        return `- Report type '${reportType}' provided without a specialized template. Keep the analysis executive, grounded and practical.`
    }
  }

  private buildReportStructuredFacts(
    analysisTarget?: SupportAnalysisTarget
  ): string {
    if (
      !analysisTarget ||
      analysisTarget.type !== "report" ||
      !analysisTarget.data ||
      typeof analysisTarget.data !== "object"
    ) {
      return "No structured report facts available."
    }

    const root = analysisTarget.data as Record<string, unknown>
    const reportType =
      typeof root.reportType === "string" ? root.reportType : undefined
    const reportPayload = this.unwrapReportPayload(root)

    if (!reportType || !reportPayload) {
      return "No structured report facts available."
    }

    switch (reportType) {
      case "income_statement":
        return this.buildIncomeStatementFacts(reportPayload)
      case "dre":
        return this.buildDREFacts(reportPayload)
      case "monthly_tithes":
        return this.buildMonthlyTithesFacts(reportPayload)
      default:
        return `No structured facts template for reportType '${reportType}'.`
    }
  }

  private unwrapReportPayload(
    root: Record<string, unknown>
  ): Record<string, unknown> | unknown[] | undefined {
    const reportData = root.reportData

    if (Array.isArray(reportData)) {
      return reportData
    }

    if (reportData && typeof reportData === "object") {
      return reportData as Record<string, unknown>
    }

    return root
  }

  private buildIncomeStatementFacts(
    payload: Record<string, unknown> | unknown[]
  ): string {
    if (!payload || Array.isArray(payload)) {
      return "Income statement payload is not in the expected object format."
    }

    const summaryEntry = this.asRecord(this.firstItem(payload.summary))
    const summary = this.asRecord(summaryEntry?.summary)
    const breakdownEntry = this.asRecord(this.firstItem(payload.breakdown))
    const breakdownRows = this.asArrayOfRecords(breakdownEntry?.breakdown)
    const cashFlow = this.asRecord(payload.cashFlowSnapshot)
    const availability = this.asRecord(cashFlow?.availabilityAccounts)
    const availabilityAccounts = this.asArrayOfRecords(availability?.accounts)
    const availabilityTotals = this.asRecord(
      this.firstItem(availability?.totals)
    )
    const costCenters = this.asRecord(cashFlow?.costCenters)
    const costCenterRows = this.asArrayOfRecords(costCenters?.costCenters)

    const totalIncome = this.num(summary?.totalIncome)
    const totalExpenses = this.num(summary?.totalExpenses)
    const netIncome = this.num(summary?.netIncome)
    const revenue = this.num(summary?.revenue)
    const operatingExpenses = this.num(summary?.operatingExpenses)
    const cogs = this.num(summary?.cogs)

    const topIncomeCategory = this.pickTopCategory(breakdownRows, "income")
    const topExpenseCategory = this.pickTopCategory(breakdownRows, "expenses")
    const topTreasury = this.pickTopAvailabilityAccount(availabilityAccounts)
    const topCostCenter = this.pickTopCostCenter(costCenterRows)

    return [
      "Income statement facts:",
      totalIncome !== undefined
        ? `- Total income: ${this.money(totalIncome)}`
        : "- Total income: unavailable",
      totalExpenses !== undefined
        ? `- Total expenses: ${this.money(totalExpenses)}`
        : "- Total expenses: unavailable",
      netIncome !== undefined
        ? `- Net result: ${this.money(netIncome)} ${netIncome >= 0 ? "(surplus)" : "(deficit)"}`
        : "- Net result: unavailable",
      revenue !== undefined
        ? `- Revenue line in summary: ${this.money(revenue)}`
        : "- Revenue line in summary: unavailable",
      operatingExpenses !== undefined
        ? `- Operating expenses: ${this.money(operatingExpenses)}`
        : "- Operating expenses: unavailable",
      cogs !== undefined
        ? `- Direct costs (COGS): ${this.money(cogs)}`
        : "- Direct costs (COGS): unavailable",
      topIncomeCategory
        ? `- Strongest income category: ${topIncomeCategory.category} with ${this.money(topIncomeCategory.amount)}`
        : "- Strongest income category: unavailable",
      topExpenseCategory
        ? `- Strongest expense category: ${topExpenseCategory.category} with ${this.money(topExpenseCategory.amount)}`
        : "- Strongest expense category: unavailable",
      topTreasury
        ? `- Treasury/account with highest inflow: ${topTreasury.name} (${topTreasury.type}) with input ${this.money(topTreasury.input)} and output ${this.money(topTreasury.output)}`
        : "- Treasury/account concentration: unavailable",
      availabilityTotals
        ? `- Treasury totals snapshot: income ${this.money(this.num(availabilityTotals.income) ?? 0)}, expenses ${this.money(this.num(availabilityTotals.expenses) ?? 0)}, net ${this.money(this.num(availabilityTotals.total) ?? 0)}`
        : "- Treasury totals snapshot: unavailable",
      topCostCenter
        ? `- Cost center with highest movement concentration in treasury snapshot: ${topCostCenter.name} with ${this.money(topCostCenter.amount)}`
        : "- Cost center concentration: unavailable",
    ].join("\n")
  }

  private buildDREFacts(payload: Record<string, unknown> | unknown[]): string {
    const row = Array.isArray(payload)
      ? this.asRecord(this.firstItem(payload))
      : this.asRecord(this.firstItem(payload.records)) || this.asRecord(payload)

    if (!row) {
      return "DRE payload is not in the expected format."
    }

    const grossRevenue = this.num(row.grossRevenue)
    const operationalExpenses = this.num(row.operationalExpenses)
    const extraordinaryResults = this.num(row.extraordinaryResults)
    const operationalResult = this.num(row.operationalResult)
    const netResult = this.num(row.netResult)
    const directCosts = this.num(row.directCosts)
    const ministryTransfers = this.num(row.ministryTransfers)

    return [
      "DRE facts:",
      grossRevenue !== undefined
        ? `- Main regular income in the month: ${this.money(grossRevenue)}`
        : "- Main regular income in the month: unavailable",
      directCosts !== undefined
        ? `- Direct costs in the month: ${this.money(directCosts)}`
        : "- Direct costs in the month: unavailable",
      operationalExpenses !== undefined
        ? `- Main recurring expense pressure in the month: ${this.money(operationalExpenses)}`
        : "- Main recurring expense pressure in the month: unavailable",
      ministryTransfers !== undefined
        ? `- Ministry transfers in the month: ${this.money(ministryTransfers)}`
        : "- Ministry transfers in the month: unavailable",
      operationalResult !== undefined
        ? `- Result from regular operations: ${this.money(operationalResult)} ${operationalResult >= 0 ? "(positive)" : "(negative)"}`
        : "- Result from regular operations: unavailable",
      extraordinaryResults !== undefined
        ? `- Extra non-recurring contribution to the final result: ${this.money(extraordinaryResults)}`
        : "- Extra non-recurring contribution to the final result: unavailable",
      netResult !== undefined
        ? `- Final result of the month: ${this.money(netResult)} ${netResult >= 0 ? "(positive)" : "(negative)"}`
        : "- Final result of the month: unavailable",
    ].join("\n")
  }

  private buildMonthlyTithesFacts(
    payload: Record<string, unknown> | unknown[]
  ): string {
    if (!payload || Array.isArray(payload)) {
      return "Monthly tithes payload is not in the expected object format."
    }

    const records = this.asArrayOfRecords(payload.records)
    const totals = this.asRecord(this.firstItem(payload.totals))
    const total = this.num(totals?.total)
    const byAccount = new Map<string, number>()
    let largestEntry:
      | { amount: number; date: string; account: string }
      | undefined

    for (const record of records) {
      const amount = this.num(record.amount)
      const accountName =
        typeof record.availabilityAccountName === "string"
          ? record.availabilityAccountName
          : "Unknown account"
      const date =
        typeof record.date === "string"
          ? record.date.slice(0, 10)
          : "unknown date"

      if (amount === undefined) {
        continue
      }

      byAccount.set(accountName, (byAccount.get(accountName) ?? 0) + amount)

      if (!largestEntry || amount > largestEntry.amount) {
        largestEntry = {
          amount,
          date,
          account: accountName,
        }
      }
    }

    const topAccount = [...byAccount.entries()].sort((a, b) => b[1] - a[1])[0]
    const average =
      total !== undefined && records.length > 0
        ? (total / records.length).toFixed(2)
        : undefined

    return [
      "Monthly tithes facts:",
      total !== undefined
        ? `- Total tithes in the period: ${this.money(total)}`
        : "- Total tithes in the period: unavailable",
      `- Number of tithe records: ${records.length}`,
      average
        ? `- Average tithe record: ${this.money(Number(average))}`
        : "- Average tithe record: unavailable",
      topAccount
        ? `- Account/treasury with highest concentration: ${topAccount[0]} with ${this.money(topAccount[1])}`
        : "- Account concentration: unavailable",
      largestEntry
        ? `- Largest single tithe record: ${this.money(largestEntry.amount)} on ${largestEntry.date} in ${largestEntry.account}`
        : "- Largest single tithe record: unavailable",
    ].join("\n")
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined
  }

  private firstItem(value: unknown): unknown {
    return Array.isArray(value) && value.length > 0 ? value[0] : undefined
  }

  private asArrayOfRecords(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
  }

  private num(value: unknown): number | undefined {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim().length > 0
          ? Number(value)
          : undefined

    return typeof parsed === "number" && Number.isFinite(parsed)
      ? parsed
      : undefined
  }

  private money(value: number): string {
    return `R$ ${value.toFixed(2)}`
  }

  private pickTopCategory(
    rows: Record<string, unknown>[],
    field: "income" | "expenses"
  ): { category: string; amount: number } | undefined {
    const ranked = rows
      .map((row) => ({
        category:
          typeof row.category === "string" ? row.category : "UNKNOWN_CATEGORY",
        amount: this.num(row[field]) ?? 0,
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    return ranked[0]
  }

  private pickTopAvailabilityAccount(rows: Record<string, unknown>[]):
    | {
        name: string
        type: string
        input: number
        output: number
      }
    | undefined {
    const ranked = rows
      .map((row) => {
        const account = this.asRecord(row.availabilityAccount)
        return {
          name:
            typeof account?.accountName === "string"
              ? account.accountName
              : "Unknown account",
          type:
            typeof account?.accountType === "string"
              ? account.accountType
              : "UNKNOWN",
          input: this.num(row.totalInput) ?? 0,
          output: this.num(row.totalOutput) ?? 0,
        }
      })
      .sort((a, b) => b.input - a.input)

    return ranked[0]
  }

  private pickTopCostCenter(
    rows: Record<string, unknown>[]
  ): { name: string; amount: number } | undefined {
    const ranked = rows
      .map((row) => {
        const costCenter = this.asRecord(row.costCenter)
        return {
          name:
            typeof costCenter?.costCenterName === "string"
              ? costCenter.costCenterName
              : "Unknown cost center",
          amount: this.num(row.total) ?? 0,
        }
      })
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    return ranked[0]
  }
}
