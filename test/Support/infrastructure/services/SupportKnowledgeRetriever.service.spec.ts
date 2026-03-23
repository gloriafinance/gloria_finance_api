import { SupportKnowledgeRetrieverService } from "@/Support/infrastructure/services/SupportKnowledgeRetriever.service"

describe("SupportKnowledgeRetrieverService", () => {
  const service = new SupportKnowledgeRetrieverService()

  it("retrieves patrimony knowledge for church asset questions", () => {
    const result = service.retrieve({
      question: "Se puede registrar los bienes de la iglesia?",
      intent: "general_support",
    })

    expect(result.sourceIds).toEqual(
      expect.arrayContaining([
        "screen:patrimony-assets-list",
        "rule:asset-vs-expense",
      ])
    )
    expect(result.contextText).toContain("/patrimony/assets")
  })

  it("retrieves report knowledge for report analysis intent", () => {
    const result = service.retrieve({
      question: "Analiza el reporte DRE de este mes",
      intent: "report_analysis",
    })

    expect(result.sourceIds).toContain("report:dre")
    expect(result.contextText).toContain("/report/dre")
  })

  it("prioritizes the declared report type when report analysis arrives with structured payload", () => {
    const result = service.retrieve({
      question: "Analiza este reporte y dime lo importante",
      intent: "report_analysis",
      analysisTarget: {
        type: "report",
        title: "Estado de resultados",
        data: {
          reportType: "income_statement",
        },
      },
    })

    expect(result.sourceIds[0]).toBe("report:income-statement")
    expect(result.contextText).toContain("AnalysisFocus:")
    expect(result.contextText).toContain("ManagementQuestions:")
  })

  it("falls back to product overview when nothing matches", () => {
    const result = service.retrieve({
      question: "zzzz qqqq xxxx",
      intent: "general_support",
    })

    expect(result.sourceIds[0]).toBe("product-overview")
  })

  it("retrieves dedicated financial concept knowledge for concept indicator questions", () => {
    const result = service.retrieve({
      question:
          "Explica la categoria del demonstrativo, affectsBalance e isOperational de un concepto financiero",
      intent: "configuration_help",
    })

    expect(result.sourceIds).toEqual(
      expect.arrayContaining([
        "concept-rule:statement-category-overview",
        "concept-rule:indicators-overview",
      ])
    )
    expect(result.contextText).toContain("FinancialConceptRule")
  })

  it("retrieves grounded contribution registration knowledge", () => {
    const result = service.retrieve({
      question:
        "Necesito registrar una contribucion de primicia que dio una hermana",
      intent: "register_financial_movement",
    })

    expect(result.sourceIds).toEqual(
      expect.arrayContaining([
        "screen:financial-record-add",
        "guide:register-received-contribution",
        "rule:online-contribution-vs-financial-record",
      ])
    )
    expect(result.routes).toContain("/financial-record/add")
  })

  it("prioritizes the current contextual route when analysis target identifies the screen", () => {
    const result = service.retrieve({
      question: "Ajude-me a registrar corretamente um movimento nesta tela.",
      intent: "register_financial_movement",
      analysisTarget: {
        type: "text",
        title: "Register financial record",
        data: {
          contextType: "screen_help",
          route: "/financial-record/add",
          module: "financial_records",
          screenTitle: "Register financial record",
        },
      },
    })

    expect(result.sourceIds[0]).toBe("screen:financial-record-add")
    expect(result.sourceIds).toEqual(
      expect.arrayContaining([
        "screen:financial-record-add",
        "guide:register-paid-expense",
      ])
    )
    expect(result.routes[0]).toBe("/financial-record/add")
    expect(result.contextText).toContain("Route: /financial-record/add")
  })

  it("retrieves benevolence guidance for targeted assistance cases", () => {
    const result = service.retrieve({
      question: "Necesito registrar una benevolencia para ayudar a una familia",
      intent: "register_financial_movement",
    })

    expect(result.sourceIds).toEqual(
      expect.arrayContaining([
        "guide:register-benevolence-support",
        "rule:benevolence-vs-operating-expense",
        "concept-rule:benevolence-vs-generic-opex",
      ])
    )
    expect(result.routes).toContain("/financial-record/add")
  })

  it("retrieves guest event payment guidance for invited minister cases", () => {
    const result = service.retrieve({
      question:
        "Como registro el pago a un predicador invitado para una conferencia?",
      intent: "register_financial_movement",
    })

    expect(result.sourceIds).toEqual(
      expect.arrayContaining([
        "guide:register-guest-event-payment",
        "rule:event-guest-payment",
        "concept-rule:direct-cost-vs-operating-expense",
      ])
    )
    expect(result.contextText).toContain("/financial-record/add")
  })

  it("retrieves closed month guidance for blocked posting questions", () => {
    const result = service.retrieve({
      question: "No puedo registrar porque el mes financiero está cerrado",
      intent: "configuration_help",
    })

    expect(result.sourceIds).toEqual(
      expect.arrayContaining([
        "screen:financial-months",
        "guide:review-financial-month",
        "rule:financial-month-control",
      ])
    )
    expect(result.sourceIds).toEqual(
      expect.arrayContaining([
        "screen:financial-months",
      ])
    )
    expect(result.routes).toContain("/financial-months")
  })
})
