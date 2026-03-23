jest.mock("bun", () => ({
  YAML: {
    parse: jest.fn(() => ({ providers: [] })),
  },
}), { virtual: true })

import type { FinancialConcept } from "@/FinanceConfig/domain"
import type { File } from "@/Shared/domain/types/file"
import type { SupportAssistantResponse } from "@/Support/domain/types/SupportAssistant.response"
import { SupportAssistantAgent } from "@/Support/infrastructure/agents/SupportAssistant.agent"

describe("SupportAssistantAgent", () => {
  const buildConcept = (overrides?: {
    id?: string
    name?: string
    description?: string
  }) =>
    ({
      getFinancialConceptId: () => overrides?.id ?? "concept-1",
      getName: () => overrides?.name ?? "Gasto de electricidad",
      getDescription: () =>
        overrides?.description ??
        "Pago de servicios de energia electrica de la iglesia",
    }) as FinancialConcept

  const buildResponse = (): SupportAssistantResponse => ({
    answer: "Usa la pantalla indicada",
    intent: "register_financial_movement",
    confidence: "high",
    recommendedRoute: "/financial-record/add",
    recommendedScreen: "Register financial record",
    recommendedConcept: {
      financialConceptId: "concept-1",
      name: "Gasto de electricidad",
    },
    steps: ["Abrir la pantalla"],
    warnings: [],
    extractedData: {
      documentType: "",
      vendor: "",
      amount: "",
      currency: "",
      documentDate: "",
      summary: "",
    },
    sources: ["screen:financial-record-add", "concept:concept-1"],
  })

  it("orchestrates intent, knowledge and responder without vision when there are no files", async () => {
    const intentClassifier = {
      classify: jest.fn().mockReturnValue("register_financial_movement"),
    }
    const knowledgeRetriever = {
      retrieve: jest.fn().mockReturnValue({
        contextText: "Source screen:financial-record-add\n...",
        sourceIds: ["screen:financial-record-add"],
        routes: ["/financial-record/add"],
        screenTitles: ["Register financial record"],
      }),
    }
    const visionAgent = {
      execute: jest.fn(),
    }
    const responderAgent = {
      execute: jest.fn().mockResolvedValue(buildResponse()),
    }

    const agent = new SupportAssistantAgent(
      intentClassifier as any,
      knowledgeRetriever as any,
      visionAgent as any,
      responderAgent as any
    )

    const result = await agent.execute({
      question: "Como registro el gasto de electricidad?",
      analysisTarget: undefined,
      files: [],
      lang: "es",
      churchId: "church-1",
      financialConcepts: [buildConcept()],
      conversationHistory: [],
    })

    expect(visionAgent.execute).not.toHaveBeenCalled()
    expect(responderAgent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "register_financial_movement",
        allowedSources: expect.arrayContaining([
          "screen:financial-record-add",
          "concept:concept-1",
        ]),
        allowedRoutes: ["/financial-record/add"],
        allowedScreens: ["Register financial record"],
        conversationHistory: [],
      })
    )
    expect(result.recommendedRoute).toBe("/financial-record/add")
  })

  it("uses vision agent when files are provided", async () => {
    const file: File = {
      name: "factura.png",
      mimeType: "image/png",
      data: Buffer.from("file"),
    }

    const intentClassifier = {
      classify: jest.fn().mockReturnValue("document_guidance"),
    }
    const knowledgeRetriever = {
      retrieve: jest.fn().mockReturnValue({
        contextText: "Source guide:register-paid-expense\n...",
        sourceIds: ["guide:register-paid-expense"],
        routes: ["/financial-record/add"],
        screenTitles: ["How to register a paid expense"],
      }),
    }
    const visionAgent = {
      execute: jest.fn().mockResolvedValue({
        documentType: "invoice",
        vendor: "ACME",
        amount: "120.00",
        currency: "BRL",
        documentDate: "2026-03-20",
        summary: "Conta de energia",
        hints: ["electricity"],
      }),
    }
    const responderAgent = {
      execute: jest.fn().mockResolvedValue({
        ...buildResponse(),
        intent: "document_guidance",
      }),
    }

    const agent = new SupportAssistantAgent(
      intentClassifier as any,
      knowledgeRetriever as any,
      visionAgent as any,
      responderAgent as any
    )

    await agent.execute({
      question: "Analiza esta factura y dime como registrarla",
      analysisTarget: undefined,
      files: [file],
      lang: "es",
      churchId: "church-1",
      financialConcepts: [buildConcept()],
      conversationHistory: [],
    })

    expect(visionAgent.execute).toHaveBeenCalledWith(
      [file],
      "Analiza esta factura y dime como registrarla"
    )
    expect(responderAgent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        visualContext: expect.objectContaining({
          documentType: "invoice",
          vendor: "ACME",
        }),
        allowedRoutes: ["/financial-record/add"],
      })
    )
  })

  it("selects contribution-related concepts instead of leaving all concept matching empty", async () => {
    const intentClassifier = {
      classify: jest.fn().mockReturnValue("register_financial_movement"),
    }
    const knowledgeRetriever = {
      retrieve: jest.fn().mockReturnValue({
        contextText: "Source guide:register-received-contribution\n...",
        sourceIds: ["guide:register-received-contribution"],
        routes: ["/financial-record/add"],
        screenTitles: ["Register financial record"],
      }),
    }
    const responderAgent = {
      execute: jest.fn().mockResolvedValue(buildResponse()),
    }

    const agent = new SupportAssistantAgent(
      intentClassifier as any,
      knowledgeRetriever as any,
      { execute: jest.fn() } as any,
      responderAgent as any
    )

    await agent.execute({
      question: "Necesito registrar una contribucion de primicia que dio una hermana",
      analysisTarget: undefined,
      files: [],
      lang: "es",
      churchId: "church-1",
      financialConcepts: [
        buildConcept({
          id: "concept-offering",
          name: "Ofrendas de culto",
          description: "Ofrendas recibidas durante los cultos.",
        }),
        buildConcept({
          id: "concept-expense",
          name: "Gasto de electricidad",
          description: "Pago de servicios de energia electrica de la iglesia",
        }),
      ],
      conversationHistory: [],
    })

    expect(responderAgent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        financialConcepts: expect.arrayContaining([
          expect.objectContaining({
            getFinancialConceptId: expect.any(Function),
          }),
        ]),
        allowedSources: expect.arrayContaining(["concept:concept-offering"]),
      })
    )
  })

  it("forwards contextual screen analysis target to classifier and knowledge retriever", async () => {
    const analysisTarget = {
      type: "text" as const,
      title: "Register financial record",
      data: {
        contextType: "screen_help",
        route: "/financial-record/add",
        module: "financial_records",
        screenTitle: "Register financial record",
      },
    }

    const intentClassifier = {
      classify: jest.fn().mockReturnValue("register_financial_movement"),
    }
    const knowledgeRetriever = {
      retrieve: jest.fn().mockReturnValue({
        contextText: "Source screen:financial-record-add\n...",
        sourceIds: ["screen:financial-record-add"],
        routes: ["/financial-record/add"],
        screenTitles: ["Register financial record"],
      }),
    }
    const responderAgent = {
      execute: jest.fn().mockResolvedValue(buildResponse()),
    }

    const agent = new SupportAssistantAgent(
      intentClassifier as any,
      knowledgeRetriever as any,
      { execute: jest.fn() } as any,
      responderAgent as any
    )

    await agent.execute({
      question: "Ajude-me a registrar corretamente um movimento nesta tela.",
      analysisTarget,
      files: [],
      lang: "pt-BR",
      churchId: "church-1",
      financialConcepts: [],
      conversationHistory: [],
    })

    expect(intentClassifier.classify).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Ajude-me a registrar corretamente um movimento nesta tela.",
        hasAnalysisTarget: true,
        analysisTarget,
      })
    )
    expect(knowledgeRetriever.retrieve).toHaveBeenCalledWith({
      question: "Ajude-me a registrar corretamente um movimento nesta tela.",
      intent: "register_financial_movement",
      analysisTarget,
    })
    expect(responderAgent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisTarget,
        allowedRoutes: ["/financial-record/add"],
        allowedScreens: ["Register financial record"],
        conversationHistory: [],
      })
    )
  })
})
