import { Church } from "@/Church/domain"
import {
  ConceptType,
  FinancialConcept,
  StatementCategory,
} from "@/Financial/domain"

describe("FinancialConcept impact flags", () => {
  const churchStub = {
    getChurchId: () => "church-001",
  } as unknown as Church

  it("uses revenue defaults when overrides are omitted", () => {
    const concept = FinancialConcept.create(
      "Dízimos",
      "Default revenue",
      true,
      ConceptType.INCOME,
      StatementCategory.REVENUE,
      churchStub,
      {
        affectsCashFlow: true,
        affectsResult: true,
        affectsBalance: false,
        isOperational: true,
      }
    )

    expect(concept.getAffectsCashFlow()).toBe(true)
    expect(concept.getAffectsResult()).toBe(true)
    expect(concept.getAffectsBalance()).toBe(false)
    expect(concept.getIsOperational()).toBe(true)
  })

  it("hydrates defaults for legacy primitives without flags", () => {
    const concept = FinancialConcept.fromPrimitives({
      id: "legacy-1",
      financialConceptId: "legacy-1",
      name: "Conta de luz",
      description: "Despesa operacional",
      active: true,
      type: ConceptType.OUTGO,
      statementCategory: StatementCategory.OPEX,
      createdAt: new Date().toISOString(),
      churchId: "church-001",
    })

    expect(concept.getAffectsCashFlow()).toBe(true)
    expect(concept.getAffectsResult()).toBe(true)
    expect(concept.getAffectsBalance()).toBe(false)
    expect(concept.getIsOperational()).toBe(true)
  })

  it("honours overrides when provided", () => {
    const concept = FinancialConcept.create(
      "Aporte patrimonial",
      "Evento extraordinário",
      true,
      ConceptType.INCOME,
      StatementCategory.OTHER,
      churchStub,
      { affectsBalance: true, isOperational: false }
    )

    expect(concept.getAffectsCashFlow()).toBe(true)
    expect(concept.getAffectsResult()).toBe(true)
    expect(concept.getAffectsBalance()).toBe(true)
    expect(concept.getIsOperational()).toBe(false)
  })

  it("updates individual flags without touching the rest", () => {
    const concept = FinancialConcept.create(
      "Compra de ativo",
      "Aquisição de veículo",
      true,
      ConceptType.PURCHASE,
      StatementCategory.OTHER,
      churchStub,
      {
        affectsCashFlow: true,
        affectsResult: false,
        affectsBalance: true,
        isOperational: false,
      }
    )

    expect(concept.getAffectsResult()).toBe(false)
    concept.updateImpactFlags({ affectsResult: true })
    expect(concept.getAffectsResult()).toBe(true)
    expect(concept.getAffectsBalance()).toBe(true)
    expect(concept.getIsOperational()).toBe(false)
  })
})
