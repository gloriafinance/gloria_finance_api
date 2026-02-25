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

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        needsCreate: { type: SchemaType.BOOLEAN },
        justification: {
          type: SchemaType.STRING,
          description: "Justificativa breve (máx 240 chars), sem markdown",
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
    Você é um assistente contábil e financeiro do Glória Finance.
    Seu trabalho é: (1) REUTILIZAR um conceito existente da lista, OU (2) SUGERIR a criação de um novo conceito, quando nenhum existente se aplica.
    
    VOCABULÁRIO FIXO (NÃO INVENTE):
    Tipos (type): INCOME | OUTGO | PURCHASE | REVERSAL
    Categorias (statementCategory): COGS | REVENUE | OPEX | CAPEX | MINISTRY_TRANSFERS | OTHER
    Indicadores: affectsCashFlow | affectsResult | affectsBalance | isOperational
    
    REGRA PRINCIPAL (ORDEM OBRIGATÓRIA):
    1) Sempre analise PRIMEIRO a lista "concepts" recebida.
    2) Se existir um conceito que se aplique bem, você DEVE retornar needsCreate=false
       e concept deve ser EXATAMENTE um item existente da lista (sem editar campos).
    3) Se NENHUM conceito existente se aplicar, então needsCreate=true e você deve sugerir um novo conceito.
    
    REGRAS DURAS (NÃO NEGOCIÁVEIS):
    - Saída: responda SOMENTE com um JSON válido no schema fornecido.
    - justification: curta, clara, sem markdown, máx 240 caracteres.
    - concept.financialConceptId:
      - Se needsCreate=false: DEVE ser o ID real do conceito existente escolhido na lista.
      - Se needsCreate=true: DEVE ser "" (string vazia).
    - Quando needsCreate=false:
      - concept deve ser idêntico a um conceito existente (mesmo id + name/description/type/category/flags).
    - Quando needsCreate=true:
      - concept.financialConceptId = ""
      - name <= 40 caracteres
      - description <= 80 caracteres
      - name/description no idioma solicitado (lang)
      - NÃO use nomes específicos do objeto (evite "Compra de X", marcas, modelos).
      - O conceito deve ser reutilizável em pelo menos 5 casos similares.
    - Se affectsCashFlow=true então affectsBalance DEVE ser true. a unica exceção é apenas para REVERSAL puramente contábil pode ser false.
    
    REGRAS DE CONSISTÊNCIA CONTÁBIL (OBRIGATÓRIO):
    1) Se statementCategory=CAPEX então:
       - affectsResult = false
       - isOperational = false
    
    2) Se statementCategory=REVENUE então:
       - affectsResult = true
       - affectsCashFlow = true
       - affectsBalance = true
    
    3) COGS normalmente NÃO é operacional:
       - Se statementCategory=COGS e for ação/projeto/evento específico, então isOperational=false.
       - Só use isOperational=true se a atividade for recorrente e previsível (ex.: semanal/mensal).
    
    REGRA PARA DEFINIR TYPE:
    - INCOME → quando entra dinheiro.
    - OUTGO → quando sai dinheiro (despesa geral).
    - PURCHASE → quando for compra de bens ou insumos.
    - REVERSAL → apenas para estornos/ajustes contábeis formais.
    
    REGRA DE ABSTRAÇÃO (TESTE DE REUSO):
    O "name" deve servir para pelo menos 5 situações parecidas.
    Evite termos específicos como "doces", "pizzas", "camisetas".
    Prefira nomes como:
    - "Insumos para Arrecadação"
    - "Materiais para Eventos e Projetos"
    - "Custos de Projetos e Eventos"
    
    HEURÍSTICAS DE CATEGORIA:
    - REVENUE: dízimos, ofertas, votos, doações
    - OPEX: despesas rotineiras (água, luz, internet, limpeza, aluguel, consumo)
    - COGS: custo diretamente necessário para evento/projeto específico
    - CAPEX: bem durável / melhoria permanente (equipamentos, mobiliário, reformas, melhorias fixas)
    - MINISTRY_TRANSFERS: repasses para ministérios
    - OTHER: reembolsos, estornos, venda de ativo, ajustes extraordinários
    
    CRITÉRIO DE DESEMPATE:
    Se mais de um conceito existente parecer adequado,
    escolha o MAIS GENÉRICO e MAIS REUTILIZÁVEL.
    
    REGRA DE PUREZA SEMÂNTICA:
    Evite iniciar name/description com:
    "Registro de", "Lançamento de", "Pagamento de", "Compra de", "Recebimento de".
    
    REGRAS DE IDIOMA:
    - lang pt/pt-BR => PT-BR
    - lang es/es-ES => Espanhol
    - outro/indefinido => Espanhol
    `.trim()

    const userPrompt = `
    lang: ${lang}
    Situação: ${context}
    
    Lista de conceitos existentes (use primeiro):
    ${JSON.stringify(concepts)}
    `.trim()

    try {
      return await AIProviderRouterService.getInstance().execute({
        systemPrompt,
        userPrompt,
        schema: responseSchema,
        validate: (provider, payload) =>
          this.validate(provider, payload, concepts),
      })
    } catch (error) {
      if (error instanceof AIProviderError) throw error
      throw error
    }
  }

  private validate(
    provider: string,
    payload: unknown,
    concepts: FinancialConcept[]
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

    if (c.affectsCashFlow === true && c.affectsBalance === false) {
      throw new AIProviderError(
        provider,
        undefined,
        AIProviderErrorCode.INVALID_RESPONSE,
        "Invalid response: affectsCashFlow=true requires affectsBalance=true"
      )
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

    if (!needsCreate) {
      if (financialConceptId.trim().length === 0) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          "Invalid response: needsCreate=false requires concept.financialConceptId"
        )
      }

      const match = concepts.find((x) => {
        return (
          x.getFinancialConceptId() === financialConceptId &&
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

      if (!match) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          "Invalid response: needsCreate=false but concept is not an exact existing item (including id)"
        )
      }
    }

    if (needsCreate === true) {
      if (financialConceptId !== "") {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          'Invalid response: needsCreate=true requires concept.financialConceptId=""'
        )
      }
      if (name.length > 40) {
        throw new AIProviderError(
          provider,
          undefined,
          AIProviderErrorCode.INVALID_RESPONSE,
          "Invalid response: concept.name too long (max 40)"
        )
      }
    }

    return {
      needsCreate,
      justification: justification.trim(),
      concept: c as unknown as AIFinancialConcept,
    }
  }
}
