import { ConceptType, FinancialConcept } from "@/FinanceConfig/domain"
import { AIProviderRouterService } from "@/package/ai/service/AIProviderRouter.service.ts"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError.ts"
import { type Schema, SchemaType } from "@google/generative-ai"
import { StatementCategory } from "@/Financial/domain"

export type AIFinancialConcept = {
  financialConceptId: string
  name: string
  description: string
  type: ConceptType
  statementCategory: StatementCategory
  affectsCashFlow: boolean
  affectsResult: boolean
  affectsBalance: boolean
  isOperational: boolean
}

export type FinancialConceptAgentResponse = {
  needsCreate: boolean
  justification: string
  concept: AIFinancialConcept
}

type FinancialConceptJustificationLabels = {
  conceptType: string
  statementCategory: string
  impactsCashFlow: string
  impactsResult: string
  impactsBalanceSheet: string
  recurringOperationalEvent: string
}

type FinancialConceptPromptGuide = {
  languageName: string
  conceptTypeUiValues: string[]
  statementCategoryUiValues: string[]
  noMixInstruction: string
}

const CONCEPT_TYPES = ["INCOME", "OUTGO", "PURCHASE", "REVERSAL"] as const
const STATEMENT_CATEGORIES = [
  "COGS",
  "REVENUE",
  "OPEX",
  "CAPEX",
  "MINISTRY_TRANSFERS",
  "OTHER",
] as const

export class FinancialConceptAgent {
  constructor() {}

  async execute(params: {
    context: string
    concepts: FinancialConcept[]
    lang: string
  }): Promise<FinancialConceptAgentResponse> {
    const { context, concepts, lang } = params
    const conceptsForAI = concepts.map((item) => ({
      financialConceptId: item.getFinancialConceptId(),
      name: item.getName(),
      description: item.getDescription(),
      type: item.getType(),
      statementCategory: item.getStatementCategory(),
      affectsCashFlow: item.getAffectsCashFlow(),
      affectsResult: item.getAffectsResult(),
      affectsBalance: item.getAffectsBalance(),
      isOperational: item.getIsOperational(),
    }))

    const justificationLabels = this.getJustificationLabels(lang)
    const promptGuide = this.getPromptGuide(lang)

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        needsCreate: { type: SchemaType.BOOLEAN },
        justification: {
          type: SchemaType.STRING,
          description: "Justificativa (máx 640 chars), sem markdown",
        },
        concept: {
          type: SchemaType.OBJECT,
          properties: {
            financialConceptId: {
              type: SchemaType.STRING,
              description:
                'ID do conceito existente se needsCreate=false; caso contrário ""',
            },
            name: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
            type: {
              type: SchemaType.STRING,
              format: "enum",
              enum: [...CONCEPT_TYPES],
            },
            statementCategory: {
              type: SchemaType.STRING,
              format: "enum",
              enum: [...STATEMENT_CATEGORIES],
            },
            affectsCashFlow: { type: SchemaType.BOOLEAN },
            affectsResult: { type: SchemaType.BOOLEAN },
            affectsBalance: { type: SchemaType.BOOLEAN },
            isOperational: { type: SchemaType.BOOLEAN },
          },
          required: [
            "financialConceptId",
            "name",
            "description",
            "type",
            "statementCategory",
            "affectsCashFlow",
            "affectsResult",
            "affectsBalance",
            "isOperational",
          ],
        },
      },
      required: ["needsCreate", "justification", "concept"],
    }

    const systemPrompt = `
Eres un asistente contable. Debes responder SOLO JSON valido.

Objetivo:
1) Reutilizar un concepto existente cuando aplique.
2) Crear uno nuevo solo si ninguno aplica.

Tokens permitidos (no inventar):
- type: INCOME | OUTGO | PURCHASE | REVERSAL
- statementCategory: COGS | REVENUE | OPEX | CAPEX | MINISTRY_TRANSFERS | OTHER

Definiciones obligatorias:
- statementCategory:
  - COGS: costos directos para entregar un servicio/proyecto/evento especifico.
    En simple: sin ese gasto, la actividad no ocurre.
  - REVENUE: entradas operacionales y donaciones recurrentes del periodo.
  - OPEX: gastos operacionales del dia a dia (funcionamiento normal y recurrente).
  - CAPEX: inversiones y gastos de capital de largo plazo (activos/mejoras permanentes).
  - MINISTRY_TRANSFERS: transferencias a ministerios.
  - OTHER: ingresos o gastos extraordinarios/puntuales fuera de la rutina principal.
- affectsCashFlow: true cuando el lanzamiento altera el saldo disponible tras pago/cobro.
- affectsResult: true cuando debe componer el DRE (afecta utilidad/perdida).
- affectsBalance: true para eventos que crean o liquidan activos/pasivos en el balance.
- isOperational: true SOLO para movimientos recurrentes y ordinarios.
  Si es eventual/puntual/no recurrente (por ejemplo, invitados), usar false.

Reglas estrictas de salida:
- Sin markdown y sin texto fuera del JSON.
- Sin claves extra.
- Estructura exacta:
{
  "needsCreate": boolean,
  "justification": string,
  "concept": {
    "financialConceptId": string,
    "name": string,
    "description": string,
    "type": "INCOME|OUTGO|PURCHASE|REVERSAL",
    "statementCategory": "COGS|REVENUE|OPEX|CAPEX|MINISTRY_TRANSFERS|OTHER",
    "affectsCashFlow": boolean,
    "affectsResult": boolean,
    "affectsBalance": boolean,
    "isOperational": boolean
  }
}

Reglas de decision:
- Primero revisa existingConcepts.
- Si alguno aplica: needsCreate=false y concept debe ser EXACTAMENTE uno de existingConcepts (mismos valores en todos los campos).
- Si ninguno aplica: needsCreate=true y concept.financialConceptId debe ser "".

	Reglas cuando needsCreate=true:
	- name <= 60 caracteres.
	- description <= 100 caracteres.
	- name y description en idioma lang.
	- Evita terminos demasiado especificos de un solo caso.
	- Idioma obligatorio en justification/name/description: ${promptGuide.languageName}.
	- ${promptGuide.noMixInstruction}

	Reglas contables:
	- Si affectsCashFlow=true, entonces affectsBalance=true (excepto REVERSAL puramente contable).
	- CAPEX => affectsResult=false e isOperational=false.
	- REVENUE => affectsResult=true, affectsCashFlow=true, affectsBalance=true.
	- OPEX => isOperational=true (si no es recurrente, no debe ser OPEX).
	- COGS => isOperational=false (costo directo de accion/proyecto/evento especifico).

	Formato obligatorio de justification (maximo 640 chars):
	Valores visibles para "${justificationLabels.conceptType}": ${promptGuide.conceptTypeUiValues.join(" | ")}
	Valores visibles para "${justificationLabels.statementCategory}": ${promptGuide.statementCategoryUiValues.join(" | ")}
	${justificationLabels.conceptType}: <valor visible en UI> - <razon>;
	${justificationLabels.statementCategory}: <valor visible en UI> - <razon>;
	${justificationLabels.impactsCashFlow}: <true|false> - <razon>;
	${justificationLabels.impactsResult}: <true|false> - <razon>;
	${justificationLabels.impactsBalanceSheet}: <true|false> - <razon>;
	${justificationLabels.recurringOperationalEvent}: <true|false> - <razon>.
    `.trim()

    const userPrompt = `
lang: ${lang}
context: ${context}

existingConcepts (elige de aqui cuando needsCreate=false):
${JSON.stringify(conceptsForAI)}

	Recuerda:
	- Si el contexto describe algo eventual/no recurrente, isOperational debe ser false.
	- En justification explica por que elegiste cada campo siguiendo el formato obligatorio.
	- Debe verse explicitamente el valor seleccionado en cada linea (enum o true/false).
	- NO uses codigos tecnicos (OUTGO, COGS, etc.) dentro de justification; usa el texto visible para usuario final.
	- justification/name/description deben venir solo en ${promptGuide.languageName}.
	- Si mezclas idiomas, la respuesta sera rechazada.
    `.trim()

    try {
      return await AIProviderRouterService.getInstance().execute({
        systemPrompt,
        userPrompt,
        schema: responseSchema,
        validate: (provider, payload) =>
          this.validate(provider, payload, concepts, context, lang),
      })
    } catch (error) {
      if (error instanceof AIProviderError) throw error
      throw error
    }
  }

  private validate(
    provider: string,
    payload: unknown,
    concepts: FinancialConcept[],
    context: string,
    lang: string
  ): FinancialConceptAgentResponse {
    if (!payload || typeof payload !== "object") {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: payload is not an object"
      )
    }

    const response = payload as Record<string, unknown>

    const hasOnlyKeys = (obj: Record<string, unknown>, keys: string[]) => {
      const objKeys = Object.keys(obj).sort()
      const expected = [...keys].sort()
      return JSON.stringify(objKeys) === JSON.stringify(expected)
    }

    if (!hasOnlyKeys(response, ["needsCreate", "justification", "concept"])) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: unexpected top-level keys"
      )
    }

    const needsCreate = response.needsCreate
    const justification = response.justification
    const concept = response.concept

    if (typeof needsCreate !== "boolean") {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: needsCreate must be boolean"
      )
    }

    if (
      typeof justification !== "string" ||
      justification.trim().length === 0
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: justification must be a non-empty string"
      )
    }

    const labels = this.getJustificationLabels(lang)
    const justificationNormalized = this.normalizeText(justification)
    const requiredRationaleLabels = [
      `${this.normalizeText(labels.conceptType)}:`,
      `${this.normalizeText(labels.statementCategory)}:`,
      `${this.normalizeText(labels.impactsCashFlow)}:`,
      `${this.normalizeText(labels.impactsResult)}:`,
      `${this.normalizeText(labels.impactsBalanceSheet)}:`,
      `${this.normalizeText(labels.recurringOperationalEvent)}:`,
    ]
    const missingLabel = requiredRationaleLabels.find(
      (label) => !justificationNormalized.includes(label)
    )
    if (missingLabel) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: justification must explain type, statementCategory, affectsCashFlow, affectsResult, affectsBalance and isOperational"
      )
    }

    if (!concept || typeof concept !== "object") {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: concept must be an object"
      )
    }

    const c = concept as Record<string, unknown>

    if (
      !hasOnlyKeys(c, [
        "financialConceptId",
        "name",
        "description",
        "type",
        "statementCategory",
        "affectsCashFlow",
        "affectsResult",
        "affectsBalance",
        "isOperational",
      ])
    ) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: unexpected concept keys"
      )
    }

    for (const k of [
      "affectsCashFlow",
      "affectsResult",
      "affectsBalance",
      "isOperational",
    ] as const) {
      if (typeof c[k] !== "boolean") {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          `Invalid response: concept.${k} must be boolean`
        )
      }
    }

    const financialConceptId = c.financialConceptId
    const name = c.name
    const description = c.description
    const type = c.type
    const statementCategory = c.statementCategory

    if (typeof financialConceptId !== "string") {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: concept.financialConceptId must be string"
      )
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: concept.name must be non-empty string"
      )
    }
    if (typeof description !== "string" || description.trim().length === 0) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: concept.description must be non-empty string"
      )
    }

    if (!CONCEPT_TYPES.includes(type as any)) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: invalid concept.type"
      )
    }
    if (!STATEMENT_CATEGORIES.includes(statementCategory as any)) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: invalid concept.statementCategory"
      )
    }

    for (const k of [
      "affectsCashFlow",
      "affectsResult",
      "affectsBalance",
      "isOperational",
    ] as const) {
      if (typeof c[k] !== "boolean") {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          `Invalid response: concept.${k} must be boolean`
        )
      }
    }

    const promptGuide = this.getPromptGuide(lang)
    const conceptTypeValue = this.extractLabeledValue(
      justificationNormalized,
      labels.conceptType
    )
    const statementCategoryValue = this.extractLabeledValue(
      justificationNormalized,
      labels.statementCategory
    )
    if (!conceptTypeValue || !statementCategoryValue) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: justification must include a user-facing value for concept type and statement category"
      )
    }

    const allowedConceptTypeValues = promptGuide.conceptTypeUiValues.map(
      (item) => this.normalizeText(item)
    )
    const allowedStatementCategoryValues =
      promptGuide.statementCategoryUiValues.map((item) =>
        this.normalizeText(item)
      )

    const conceptTypeMatches = allowedConceptTypeValues.some((allowed) =>
      conceptTypeValue.includes(allowed)
    )
    const statementCategoryMatches = allowedStatementCategoryValues.some(
      (allowed) => statementCategoryValue.includes(allowed)
    )

    if (!conceptTypeMatches || !statementCategoryMatches) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: justification must use the UI-visible value for concept type and statement category in the requested language"
      )
    }

    const technicalCodePattern =
      /\b(income|outgo|purchase|reversal|cogs|revenue|opex|capex|ministry_transfers)\b/
    if (technicalCodePattern.test(justificationNormalized)) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: justification must use user-facing labels instead of technical enum codes"
      )
    }

    const languageLeakPattern = this.getLanguageLeakPattern(lang)
    const combinedNaturalText = this.normalizeText(
      `${justification} ${name} ${description}`
    )
    if (languageLeakPattern && languageLeakPattern.test(combinedNaturalText)) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: justification/name/description must be written only in the requested language"
      )
    }

    if (!needsCreate) {
      const normalizedFinancialConceptId = financialConceptId.trim()
      let match = concepts.find(
        (x) => x.getFinancialConceptId() === normalizedFinancialConceptId
      )

      if (!match) {
        match = concepts.find((x) => {
          return (
            x.getName() === name &&
            x.getDescription() === description &&
            x.getType() === type &&
            x.getStatementCategory() === statementCategory &&
            x.getAffectsCashFlow() === c.affectsCashFlow &&
            x.getAffectsResult() === c.affectsResult &&
            x.getAffectsBalance() === c.affectsBalance &&
            x.getIsOperational() === c.isOperational
          )
        })
      }

      if (!match) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          "Invalid response: needsCreate=false but concept is not an exact existing item (including id)"
        )
      }

      this.hydrateConceptFromExisting(c, match)
    }

    if (needsCreate) {
      if (financialConceptId !== "") c.financialConceptId = ""

      if (c.affectsCashFlow === true && c.affectsBalance === false) {
        c.affectsBalance = true
      }

      if (name.length > 60) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          "Invalid response: concept.name too long (max 60)"
        )
      }

      const contextLower = context.toLowerCase()
      const hasOccasionalHint =
        /invitad|convidad|pregador|predicador|palestr|music|evento|eventual|esporad|pontual|ocasional|guest/.test(
          contextLower
        )
      const hasRecurringHint =
        /mensal|mensual|semanal|weekly|diari|diario|daily|rotin|routine|recurr|recurrent|fixo|fijo|regular|permanen/.test(
          contextLower
        )

      if (statementCategory === "OPEX" && c.isOperational !== true) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          "Invalid response: OPEX requires isOperational=true"
        )
      }

      if (statementCategory === "COGS" && c.isOperational !== false) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          "Invalid response: COGS requires isOperational=false"
        )
      }

      if (
        hasOccasionalHint &&
        !hasRecurringHint &&
        statementCategory === "OPEX"
      ) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          "Invalid response: occasional/non-recurring contexts should not use OPEX"
        )
      }

      if (hasOccasionalHint && !hasRecurringHint && c.isOperational === true) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          "Invalid response: isOperational should be false for occasional/non-recurring contexts"
        )
      }
    }

    return {
      needsCreate,
      justification: this.ensureIndicatorValuesInJustification(
        justification.trim(),
        labels,
        c as unknown as AIFinancialConcept,
        lang
      ),
      concept: c as unknown as AIFinancialConcept,
    }
  }

  private hydrateConceptFromExisting(
    target: Record<string, unknown>,
    source: FinancialConcept
  ): void {
    target.financialConceptId = source.getFinancialConceptId()
    target.name = source.getName()
    target.description = source.getDescription()
    target.type = source.getType()
    target.statementCategory = source.getStatementCategory()
    target.affectsCashFlow = source.getAffectsCashFlow()
    target.affectsResult = source.getAffectsResult()
    target.affectsBalance = source.getAffectsBalance()
    target.isOperational = source.getIsOperational()
  }

  private ensureIndicatorValuesInJustification(
    original: string,
    labels: FinancialConceptJustificationLabels,
    concept: AIFinancialConcept,
    lang: string
  ): string {
    const base = original.trim()
    const normalizedBase = this.normalizeText(base)
    const reason = this.getIndicatorAutoReason(lang)
    const requiredLines = [
      `${labels.impactsCashFlow}: ${String(concept.affectsCashFlow).toLowerCase()} - ${reason}`,
      `${labels.impactsResult}: ${String(concept.affectsResult).toLowerCase()} - ${reason}`,
      `${labels.impactsBalanceSheet}: ${String(concept.affectsBalance).toLowerCase()} - ${reason}`,
      `${labels.recurringOperationalEvent}: ${String(concept.isOperational).toLowerCase()} - ${reason}`,
    ]

    const missingLines = requiredLines.filter(
      (line) => !normalizedBase.includes(this.normalizeText(line))
    )
    if (missingLines.length === 0) return base
    if (!base) return missingLines.join("; ")

    const separator = base.endsWith(";") ? " " : "; "
    return `${base}${separator}${missingLines.join("; ")}`
  }

  private getIndicatorAutoReason(lang: string): string {
    const normalizedLang = String(lang ?? "")
      .trim()
      .toLowerCase()

    if (normalizedLang.startsWith("pt")) {
      return "alinhado com as regras contabeis"
    }

    if (normalizedLang.startsWith("en")) {
      return "aligned with accounting rules"
    }

    return "alineado con reglas contables"
  }

  private getJustificationLabels(
    lang: string
  ): FinancialConceptJustificationLabels {
    const normalizedLang = String(lang ?? "")
      .trim()
      .toLowerCase()

    if (normalizedLang.startsWith("pt")) {
      return {
        conceptType: "Tipo de conceito",
        statementCategory: "Categoria do demonstrativo",
        impactsCashFlow: "Impacta fluxo de caixa",
        impactsResult: "Impacta o resultado (DRE)",
        impactsBalanceSheet: "Impacta o balanço patrimonial",
        recurringOperationalEvent: "Evento operacional recorrente",
      }
    }

    if (normalizedLang.startsWith("en")) {
      return {
        conceptType: "Concept type",
        statementCategory: "Statement category",
        impactsCashFlow: "Impacts cash flow",
        impactsResult: "Impacts result (P&L)",
        impactsBalanceSheet: "Impacts balance sheet",
        recurringOperationalEvent: "Recurring operational event",
      }
    }

    return {
      conceptType: "Tipo de concepto",
      statementCategory: "Categoría del estado",
      impactsCashFlow: "Impacta flujo de caja",
      impactsResult: "Impacta el resultado (DRE)",
      impactsBalanceSheet: "Impacta el balance general",
      recurringOperationalEvent: "Evento operacional recurrente",
    }
  }

  private getPromptGuide(lang: string): FinancialConceptPromptGuide {
    const normalizedLang = String(lang ?? "")
      .trim()
      .toLowerCase()

    if (normalizedLang.startsWith("pt")) {
      return {
        languageName: "Português (pt-BR)",
        conceptTypeUiValues: ["Entrada", "Saída", "Compra", "Reversão"],
        statementCategoryUiValues: [
          "Custos diretos para entregar serviços ou projetos",
          "Entradas operacionais e doações recorrentes",
          "Despesas operacionais do dia a dia",
          "Investimentos e gastos de capital de longo prazo",
          "Repasses e contribuições ministeriais",
          "Receitas ou despesas extraordinárias",
        ],
        noMixInstruction:
          "Nao misture espanhol/ingles com portugues em nenhuma frase",
      }
    }

    if (normalizedLang.startsWith("en")) {
      return {
        languageName: "English",
        conceptTypeUiValues: ["Income", "Expense", "Purchase", "Reversal"],
        statementCategoryUiValues: [
          "Direct costs to deliver services or projects",
          "Operational inflows and recurring donations",
          "Day-to-day operating expenses",
          "Long-term capital investments and expenditures",
          "Ministry transfers and contributions",
          "Extraordinary income or expenses",
        ],
        noMixInstruction:
          "Do not mix Spanish/Portuguese words with English in any sentence",
      }
    }

    return {
      languageName: "Español",
      conceptTypeUiValues: ["Ingreso", "Salida", "Compra", "Reversión"],
      statementCategoryUiValues: [
        "Costos directos para entregar servicios o proyectos",
        "Ingresos operacionales y donaciones recurrentes",
        "Gastos operacionales del día a día",
        "Inversiones y gastos de capital de largo plazo",
        "Transferencias y contribuciones ministeriales",
        "Ingresos o gastos extraordinarios",
      ],
      noMixInstruction:
        "No mezcles portugues/ingles con espanol en ninguna frase",
    }
  }

  private extractLabeledValue(
    normalizedText: string,
    label: string
  ): string | null {
    const labelPattern = new RegExp(
      `${this.escapeRegExp(this.normalizeText(label))}\\s*:\\s*([^;\\n]+)`
    )
    const match = normalizedText.match(labelPattern)
    if (!match || !match[1]) return null

    const selectedValue = match[1].split(/\s-\s/)[0]?.trim()
    if (!selectedValue) return null

    return selectedValue
  }

  private getLanguageLeakPattern(lang: string): RegExp | null {
    const normalizedLang = String(lang ?? "")
      .trim()
      .toLowerCase()

    if (normalizedLang.startsWith("pt")) {
      return /\b(predicador(?:es)?|invitad(?:o|a|os|as)|categoria del estado|flujo de caja|balance general|evento operacional recurrente|salida|ingreso(?:s)?|reversion)\b/
    }

    if (normalizedLang.startsWith("es")) {
      return /\b(pregador(?:es)?|convidad(?:o|a|os|as)|categoria do demonstrativo|fluxo de caixa|balanco patrimonial|evento operacional recorrente|saida|entrada|reversao)\b/
    }

    if (normalizedLang.startsWith("en")) {
      return /\b(tipo de conceito|tipo de concepto|categoria do demonstrativo|categoria del estado|impacta fluxo de caixa|impacta flujo de caja|evento operacional recorrente|evento operacional recurrente|saida|ingreso|salida|reversao|reversion)\b/
    }

    return null
  }

  private normalizeText(value: string): string {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
}
