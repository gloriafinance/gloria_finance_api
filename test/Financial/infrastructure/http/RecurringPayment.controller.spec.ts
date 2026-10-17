import { ChurchBankingClient } from "@/Banking/infrastructure/church-banking/ChurchBankingClient"
import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { RecurringPaymentController } from "@/Financial/infrastructure/http/controllers/RecurringPayment.controller"
import { RecurringPaymentsMongoRepository } from "@/Financial/infrastructure/persistence/RecurringPaymentsMongoRepository"

// The controller builds the client itself; `jose` is ESM-only and jest runs as
// CommonJS, so the import is stubbed and the provider call is spied instead.
jest.mock("jose", () => ({
  CompactEncrypt: class {},
  SignJWT: class {},
  importJWK: jest.fn(),
}))

function makeResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }
}

const recurrence = RecurringPayments.fromPrimitives({
  recurringPaymentId: "recurring-1",
  churchId: "church-1",
  financialConceptId: "concept-1",
  costCenterId: "cost-center-1",
  name: "Energy",
  type: "VARIABLE",
  dayOfMonth: 10,
  status: "ACTIVE",
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("RecurringPaymentController.simulateBill", () => {
  it("simulates with the church of the authenticated request and returns the snapshot", async () => {
    const one = jest.fn().mockResolvedValue(recurrence)
    jest
      .spyOn(RecurringPaymentsMongoRepository, "getInstance")
      .mockReturnValue({ one } as never)
    const snapshot = {
      minimumScheduleDate: "2026-10-02",
      feeInCents: 0,
      bankSlip: { valueInCents: 74283, beneficiaryName: "Fornecedor" },
    }
    const simulateBill = jest
      .spyOn(ChurchBankingClient.prototype, "simulateBill")
      .mockResolvedValue(snapshot)
    const response = makeResponse()

    await new RecurringPaymentController().simulateBill(
      "recurring-1",
      { identificationField: "0339920159510052904014760030102388844" },
      { auth: { churchId: "church-1" } } as never,
      response as never
    )

    expect(one).toHaveBeenCalledWith({
      recurringPaymentId: "recurring-1",
      churchId: "church-1",
      status: "ACTIVE",
    })
    expect(simulateBill).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      identificationField: "0339920159510052904014760030102388844",
    })
    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.send).toHaveBeenCalledWith(snapshot)
  })

  it("answers a domain error when the recurrence is not payable", async () => {
    jest
      .spyOn(RecurringPaymentsMongoRepository, "getInstance")
      .mockReturnValue({ one: jest.fn().mockResolvedValue(undefined) } as never)
    const simulateBill = jest.spyOn(
      ChurchBankingClient.prototype,
      "simulateBill"
    )
    const response = makeResponse()

    await new RecurringPaymentController().simulateBill(
      "recurring-1",
      { barCode: "03391815100000029909777729900000000475110101" },
      { auth: { churchId: "church-1" } } as never,
      response as never
    )

    expect(simulateBill).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.send).toHaveBeenCalledWith({
      code: "RECURRING_PAYMENT_NOT_FOUND",
      message: "Recurring payment not found",
    })
  })

  it("keeps a provider outage as an outage", async () => {
    jest
      .spyOn(RecurringPaymentsMongoRepository, "getInstance")
      .mockReturnValue({
        one: jest.fn().mockResolvedValue(recurrence),
      } as never)
    jest
      .spyOn(ChurchBankingClient.prototype, "simulateBill")
      .mockRejectedValue(
        new ChurchBankingClientError(503, "SIMULATE_UNAVAILABLE")
      )
    const response = makeResponse()

    await new RecurringPaymentController().simulateBill(
      "recurring-1",
      { identificationField: "line" },
      { auth: { churchId: "church-1" } } as never,
      response as never
    )

    expect(response.status).toHaveBeenCalledWith(503)
    expect(response.send).toHaveBeenCalledWith({ code: "SIMULATE_UNAVAILABLE" })
  })
})
