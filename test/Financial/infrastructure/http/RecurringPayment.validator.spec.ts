import {
  validatePayRecurringPayment,
  validateRecurringPaymentConfiguration,
} from "@/Financial/infrastructure/http/validators/RecurringPayment.validator"

function makeResponse() {
  const response = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }
  return response
}

describe("recurring payment HTTP validation", () => {
  it("accepts a fixed PIX recurrence using its configured payment details", async () => {
    const response = makeResponse()
    const next = jest.fn()
    await validateRecurringPaymentConfiguration(
      {
        body: {
          name: "Aluguel",
          financialConceptId: "concept-1",
          type: "FIXED",
          amount: 3500,
          dayOfMonth: 10,
          payment: {
            method: "PIX",
            pixKey: "finance@example.org",
            pixKeyType: "EMAIL",
          },
          status: "ACTIVE",
        },
      } as never,
      response as never,
      next
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(response.send).not.toHaveBeenCalled()
  })

  it("rejects fields outside the configuration contract", async () => {
    const response = makeResponse()
    const next = jest.fn()
    await validateRecurringPaymentConfiguration(
      {
        body: {
          name: "Aluguel",
          financialConceptId: "concept-1",
          type: "FIXED",
          amount: 3500,
          dayOfMonth: 10,
          payment: { method: "BILL" },
          lastPayment: "2026-10-01",
        },
      } as never,
      response as never,
      next
    )

    expect(response.status).toHaveBeenCalledWith(422)
    expect(response.send).toHaveBeenCalledWith({
      code: "RECURRING_PAYMENT_PAYLOAD_INVALID",
    })
    expect(next).not.toHaveBeenCalled()
  })

  it("requires competence in YYYY-MM format for execution", async () => {
    const response = makeResponse()
    const next = jest.fn()
    await validatePayRecurringPayment(
      { body: { competence: "2026-13" } } as never,
      response as never,
      next
    )

    expect(response.status).toHaveBeenCalledWith(422)
    expect(next).not.toHaveBeenCalled()
  })
})
