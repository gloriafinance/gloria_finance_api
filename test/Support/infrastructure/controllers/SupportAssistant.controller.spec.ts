jest.mock("bun", () => ({
  YAML: {
    parse: jest.fn(() => ({ providers: [] })),
  },
}), { virtual: true })

jest.mock("@/Shared/infrastructure", () => ({
  PermissionMiddleware: jest.fn(),
}))

jest.mock("@/FinanceConfig/infrastructure/presistence", () => ({
  FinancialConceptMongoRepository: {
    getInstance: jest.fn(),
  },
}))

jest.mock("@/Shared/helpers/domainResponse", () => ({
  __esModule: true,
  default: jest.fn(),
}))

const executeMock = jest.fn()
const resolveConversationMock = jest.fn()
const appendTurnMock = jest.fn()
const listRecentConversationsMock = jest.fn()
const loadConversationTurnsMock = jest.fn()
const deleteConversationMock = jest.fn()

jest.mock("@/Support/infrastructure/agents/SupportAssistant.agent", () => ({
  SupportAssistantAgent: jest.fn().mockImplementation(() => ({
    execute: executeMock,
  })),
}))

jest.mock("@/Support/infrastructure/services/SupportConversationMemory.service", () => ({
  SupportConversationMemoryService: jest.fn().mockImplementation(() => ({
    resolveConversation: resolveConversationMock,
    appendTurn: appendTurnMock,
    listRecentConversations: listRecentConversationsMock,
    loadConversationTurns: loadConversationTurnsMock,
    deleteConversation: deleteConversationMock,
  })),
}))

import { GenericException, HttpStatus } from "@/Shared/domain"
import { SupportAssistantController } from "@/Support/infrastructure/controllers/SupportAssistant.controller"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import domainResponse from "@/Shared/helpers/domainResponse"

describe("SupportAssistantController", () => {
  const buildResponse = () => ({
    answer: "Respuesta del asistente",
    intent: "general_support" as const,
    confidence: "high" as const,
    recommendedRoute: "",
    recommendedScreen: "",
    recommendedConcept: {
      financialConceptId: "",
      name: "",
    },
    steps: [],
    warnings: [],
    extractedData: {
      documentType: "",
      vendor: "",
      amount: "",
      currency: "",
      documentDate: "",
      summary: "",
    },
    sources: ["product-overview"],
  })

  const buildRes = () => {
    const res = {
      status: jest.fn(),
      send: jest.fn(),
    }
    res.status.mockReturnValue(res)
    return res
  }

  const buildReq = (overrides?: Record<string, unknown>) =>
    ({
      auth: {
        churchId: "church-1",
        lang: "pt-BR",
        userId: "user-1",
      },
      files: undefined,
      ...overrides,
    }) as any

  beforeEach(() => {
    jest.restoreAllMocks()
    executeMock.mockReset()
    resolveConversationMock.mockReset()
    appendTurnMock.mockReset()
    listRecentConversationsMock.mockReset()
    loadConversationTurnsMock.mockReset()
    deleteConversationMock.mockReset()
    ;(domainResponse as jest.Mock).mockClear()
  })

  it("returns 200 for a text-only support request", async () => {
    const repo = {
      search: jest.fn().mockResolvedValue([]),
    }
    jest
      .spyOn(FinancialConceptMongoRepository, "getInstance")
      .mockReturnValue(repo as any)
    resolveConversationMock.mockResolvedValue({
      conversationId: "conv-1",
      history: [],
    })
    appendTurnMock.mockResolvedValue(undefined)
    executeMock.mockResolvedValue(buildResponse())

    const controller = new SupportAssistantController()
    const res = buildRes()

    await controller.support(
      { question: "Que es Gloria Finance?" },
      buildReq(),
      res as any
    )

    expect(domainResponse).not.toHaveBeenCalled()
    expect(repo.search).toHaveBeenCalledWith({
      churchId: "church-1",
      active: true,
    })
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Que es Gloria Finance?",
        files: [],
        churchId: "church-1",
        lang: "pt-BR",
        conversationHistory: [],
      })
    )
    expect(appendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-1",
        churchId: "church-1",
        userId: "user-1",
      })
    )
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK)
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: "Respuesta del asistente",
        conversationId: "conv-1",
      })
    )
  })

  it("normalizes uploaded files before invoking the agent", async () => {
    const repo = {
      search: jest.fn().mockResolvedValue([]),
    }
    jest
      .spyOn(FinancialConceptMongoRepository, "getInstance")
      .mockReturnValue(repo as any)
    resolveConversationMock.mockResolvedValue({
      conversationId: "conv-1",
      history: [],
    })
    appendTurnMock.mockResolvedValue(undefined)
    executeMock.mockResolvedValue(buildResponse())

    const controller = new SupportAssistantController()
    const res = buildRes()

    await controller.support(
      { question: "Analiza esta factura" },
      buildReq({
        files: {
          file: {
            name: "factura.png",
            mimeType: "image/png",
            data: Buffer.from("image-data"),
          },
        },
      }),
      res as any
    )

    expect(domainResponse).not.toHaveBeenCalled()
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [
          expect.objectContaining({
            name: "factura.png",
            mimeType: "image/png",
            data: expect.any(Buffer),
          }),
        ],
      })
    )
  })

  it("translates domain errors through domainResponse", async () => {
    const repo = {
      search: jest.fn().mockResolvedValue([]),
    }
    jest
      .spyOn(FinancialConceptMongoRepository, "getInstance")
      .mockReturnValue(repo as any)
    resolveConversationMock.mockResolvedValue({
      conversationId: "conv-1",
      history: [],
    })
    executeMock.mockRejectedValue(
      new GenericException(
        "La solicitud pide analisis, pero no se adjunto ningun archivo ni datos para analizar."
      )
    )

    const controller = new SupportAssistantController()
    const res = buildRes()

    await controller.support(
      { question: "Analiza este reporte" },
      buildReq(),
      res as any
    )

    expect(domainResponse).toHaveBeenCalledWith(expect.any(GenericException), res)
  })

  it("forwards analysis target when the request includes structured data", async () => {
    const repo = {
      search: jest.fn().mockResolvedValue([]),
    }
    jest
      .spyOn(FinancialConceptMongoRepository, "getInstance")
      .mockReturnValue(repo as any)
    resolveConversationMock.mockResolvedValue({
      conversationId: "conv-report",
      history: [],
    })
    appendTurnMock.mockResolvedValue(undefined)
    executeMock.mockResolvedValue(buildResponse())

    const controller = new SupportAssistantController()
    const res = buildRes()

    await controller.support(
      {
        question: "Analiza este reporte de ingresos",
        analysisTarget: {
          type: "report",
          title: "Income Statement March 2026",
          data: {
            revenue: 1200,
            cogs: 300,
            opex: 400,
          },
        },
      },
      buildReq(),
      res as any
    )

    expect(domainResponse).not.toHaveBeenCalled()
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisTarget: {
          type: "report",
          title: "Income Statement March 2026",
          data: {
            revenue: 1200,
            cogs: 300,
            opex: 400,
          },
        },
        conversationHistory: [],
      })
    )
  })

  it("returns stored conversation messages with the full structured response", async () => {
    const controller = new SupportAssistantController()
    const res = buildRes()

    loadConversationTurnsMock.mockResolvedValue([
      {
        question: "Como registro este movimiento?",
        answer: "Use registro financiero.",
        intent: "register_financial_movement",
        response: {
          answer: "Use registro financiero.",
          intent: "register_financial_movement",
          confidence: "high",
          recommendedRoute: "/financial-record/add",
          recommendedScreen: "Register financial record",
          recommendedConcept: {
            financialConceptId: "concept-1",
            name: "Ingreso general",
          },
          steps: ["Abra la pantalla indicada"],
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
        },
        sources: ["screen:financial-record-add", "concept:concept-1"],
        createdAt: "2026-03-22T10:00:00.000Z",
      },
    ])

    await controller.getConversation("conv-1", buildReq(), res as any)

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK)
    expect(res.send).toHaveBeenCalledWith({
      conversationId: "conv-1",
      messages: [
        expect.objectContaining({
          response: expect.objectContaining({
            recommendedRoute: "/financial-record/add",
            recommendedScreen: "Register financial record",
            steps: ["Abra la pantalla indicada"],
          }),
        }),
      ],
    })
  })

  it("deletes an owned conversation", async () => {
    const controller = new SupportAssistantController()
    const res = buildRes()

    deleteConversationMock.mockResolvedValue(undefined)

    await controller.deleteConversation("conv-1", buildReq(), res as any)

    expect(deleteConversationMock).toHaveBeenCalledWith({
      churchId: "church-1",
      userId: "user-1",
      conversationId: "conv-1",
    })
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK)
    expect(res.send).toHaveBeenCalledWith({
      conversationId: "conv-1",
      deleted: true,
    })
  })
})
