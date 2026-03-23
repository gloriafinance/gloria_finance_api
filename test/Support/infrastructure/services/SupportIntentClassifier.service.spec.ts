import { GenericException } from "@/Shared/domain"
import { SupportIntentClassifierService } from "@/Support/infrastructure/services/SupportIntentClassifier.service"

describe("SupportIntentClassifierService", () => {
  const service = new SupportIntentClassifierService()

  it("classifies product overview questions", () => {
    const intent = service.classify({
      question: "Que es Gloria Finance?",
      hasFiles: false,
      hasAnalysisTarget: false,
    })

    expect(intent).toBe("product_overview")
  })

  it("requires attachments or analysis data when the user requests analysis", () => {
    expect(() =>
      service.classify({
        question: "Analiza este reporte",
        hasFiles: false,
        hasAnalysisTarget: false,
      })
    ).toThrow(GenericException)
  })

  it("classifies file-based requests as document guidance", () => {
    const intent = service.classify({
      question: "Analiza esta factura y dime como registrarla",
      hasFiles: true,
      hasAnalysisTarget: false,
    })

    expect(intent).toBe("document_guidance")
  })

  it("classifies report analysis when there is analysis data", () => {
    const intent = service.classify({
      question: "Analiza este reporte DRE",
      hasFiles: false,
      hasAnalysisTarget: true,
    })

    expect(intent).toBe("report_analysis")
  })

  it("classifies contribution registration questions as financial movement", () => {
    const intent = service.classify({
      question: "Necesito registrar una contribucion de primicia que dio una hermana",
      hasFiles: false,
      hasAnalysisTarget: false,
    })

    expect(intent).toBe("register_financial_movement")
  })

  it("classifies benevolence and guest payment questions as financial movement", () => {
    expect(
      service.classify({
        question: "Como registro una benevolencia para ayudar a una familia?",
        hasFiles: false,
        hasAnalysisTarget: false,
      })
    ).toBe("register_financial_movement")

    expect(
      service.classify({
        question: "Como registro el pago a un músico invitado?",
        hasFiles: false,
        hasAnalysisTarget: false,
      })
    ).toBe("register_financial_movement")
  })

  it("classifies closed-month questions as configuration help", () => {
    const intent = service.classify({
      question: "No puedo lanzar el movimiento porque el mes financiero está cerrado",
      hasFiles: false,
      hasAnalysisTarget: false,
    })

    expect(intent).toBe("configuration_help")
  })
})
