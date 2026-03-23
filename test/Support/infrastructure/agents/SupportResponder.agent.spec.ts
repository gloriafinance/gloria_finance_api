jest.mock("bun", () => ({
  YAML: {
    parse: jest.fn(() => ({ providers: [] })),
  },
}), { virtual: true })

import type { SupportAssistantResponse } from "@/Support/domain/types/SupportAssistant.response"
import { SupportResponderAgent } from "@/Support/infrastructure/agents/SupportResponder.agent"

describe("SupportResponderAgent", () => {
  const buildResponse = (): SupportAssistantResponse => ({
    answer: "Analisis listo",
    intent: "report_analysis",
    confidence: "high",
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
    sources: ["report:income-statement"],
  })

  it("adds structured income statement facts to the prompt", async () => {
    const execute = jest.fn().mockResolvedValue(buildResponse())
    const agent = new SupportResponderAgent({ execute } as any)

    await agent.execute({
      question: "Analiza este reporte y explica los puntos principales.",
      lang: "es",
      intent: "report_analysis",
      churchId: "church-1",
      knowledgeContext: "Source report:income-statement\n...",
      analysisTarget: {
        type: "report",
        title: "Estado de resultados",
        data: {
          reportType: "income_statement",
          reportData: {
            summary: [
              {
                symbol: "R$",
                summary: {
                  totalIncome: 4067.86,
                  totalExpenses: 31.49,
                  netIncome: 4036.37,
                  revenue: 4067.86,
                  operatingExpenses: 31.49,
                  cogs: 0,
                },
              },
            ],
            breakdown: [
              {
                symbol: "R$",
                breakdown: [
                  { category: "REVENUE", income: 3395.36, expenses: 0 },
                  { category: "OTHER", income: 672.5, expenses: 0 },
                  { category: "OPEX", income: 0, expenses: 31.49 },
                ],
              },
            ],
            cashFlowSnapshot: {
              availabilityAccounts: {
                accounts: [
                  {
                    totalInput: 3913.86,
                    totalOutput: 130.49,
                    availabilityAccount: {
                      accountName: "Tesouro Principal",
                      accountType: "BANK",
                    },
                  },
                ],
                totals: [
                  {
                    income: 4188.86,
                    expenses: 229.49,
                    total: 3959.37,
                  },
                ],
              },
              costCenters: {
                costCenters: [
                  {
                    total: 332.47,
                    costCenter: { costCenterName: "Administracao" },
                  },
                ],
              },
            },
          },
        },
      },
      conversationHistory: [],
      financialConcepts: [],
      allowedSources: ["report:income-statement"],
      allowedRoutes: [],
      allowedScreens: [],
    })

    const userPrompt = execute.mock.calls[0][0].userPrompt as string

    expect(userPrompt).toContain("Structured report facts:")
    expect(userPrompt).toContain("Total income: R$ 4067.86")
    expect(userPrompt).toContain("Net result: R$ 4036.37 (surplus)")
    expect(userPrompt).toContain(
      "Strongest expense category: OPEX with R$ 31.49"
    )
    expect(userPrompt).toContain(
      "Cost center with highest movement concentration in treasury snapshot: Administracao with R$ 332.47"
    )
    expect(userPrompt).toContain(
      "State explicitly which category brought in the most money and which category consumed the most money."
    )
    expect(userPrompt).toContain(
      "Do not focus on net-margin percentages unless the user explicitly asks for ratios."
    )
  })

  it("adds structured monthly tithes facts to the prompt", async () => {
    const execute = jest.fn().mockResolvedValue({
      ...buildResponse(),
      sources: ["report:monthly-tithes"],
    })
    const agent = new SupportResponderAgent({ execute } as any)

    await agent.execute({
      question: "Analiza este reporte de diezmos.",
      lang: "es",
      intent: "report_analysis",
      churchId: "church-1",
      knowledgeContext: "Source report:monthly-tithes\n...",
      analysisTarget: {
        type: "report",
        title: "Diezmos mensuales",
        data: {
          reportType: "monthly_tithes",
          reportData: {
            records: [
              {
                amount: 250,
                date: "2026-03-02T00:00:00.000Z",
                availabilityAccountName: "Tesouro Principal",
              },
              {
                amount: 1700,
                date: "2026-03-02T03:00:00.000Z",
                availabilityAccountName: "Tesouro Principal",
              },
            ],
            totals: [{ total: 1950 }],
          },
        },
      },
      conversationHistory: [],
      financialConcepts: [],
      allowedSources: ["report:monthly-tithes"],
      allowedRoutes: [],
      allowedScreens: [],
    })

    const userPrompt = execute.mock.calls[0][0].userPrompt as string

    expect(userPrompt).toContain("Monthly tithes facts:")
    expect(userPrompt).toContain("Total tithes in the period: R$ 1950.00")
    expect(userPrompt).toContain("Number of tithe records: 2")
    expect(userPrompt).toContain(
      "Account/treasury with highest concentration: Tesouro Principal with R$ 1950.00"
    )
    expect(userPrompt).toContain(
      "Mention which treasury or account concentrated the most tithes and whether one single record stands out too much."
    )
    expect(userPrompt).toContain(
      "Do not infer that a concentration came from one donor or one family unless the report explicitly identifies that source."
    )
    expect(userPrompt).toContain(
      "Do not suggest creating a new treasury or account as a default recommendation when the payload only shows that one treasury received the tithes."
    )
  })

  it("adds simplified DRE facts and guidance to the prompt", async () => {
    const execute = jest.fn().mockResolvedValue({
      ...buildResponse(),
      sources: ["report:dre"],
    })
    const agent = new SupportResponderAgent({ execute } as any)

    await agent.execute({
      question: "Analise este relatório DRE.",
      lang: "pt-BR",
      intent: "report_analysis",
      churchId: "church-1",
      knowledgeContext: "Source report:dre\n...",
      analysisTarget: {
        type: "report",
        title: "DRE",
        data: {
          reportType: "dre",
          reportData: [
            {
              grossRevenue: 3395.36,
              directCosts: 0,
              operationalExpenses: 31.49,
              ministryTransfers: 0,
              operationalResult: 3363.87,
              extraordinaryResults: 672.5,
              netResult: 4036.37,
            },
          ],
        },
      },
      conversationHistory: [],
      financialConcepts: [],
      allowedSources: ["report:dre"],
      allowedRoutes: [],
      allowedScreens: [],
    })

    const userPrompt = execute.mock.calls[0][0].userPrompt as string

    expect(userPrompt).toContain(
      "Prefer simple terms such as regular income, month expenses, extra entry and final result."
    )
    expect(userPrompt).toContain(
      "Main regular income in the month: R$ 3395.36"
    )
    expect(userPrompt).toContain(
      "Main recurring expense pressure in the month: R$ 31.49"
    )
    expect(userPrompt).toContain(
      "Extra non-recurring contribution to the final result: R$ 672.50"
    )
    expect(userPrompt).toContain(
      "Final result of the month: R$ 4036.37 (positive)"
    )
  })
})
