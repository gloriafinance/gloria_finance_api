import {
  validatePayRecurringPayment,
  validateRecurringPaymentConfiguration,
  validateRegisterRecurringPayment,
  validateSimulateRecurringPaymentBill,
} from "@/Financial/infrastructure/http/validators/RecurringPayment.validator"

function makeResponse() {
  const response = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }
  return response
}

const configuration = {
  name: "Aluguel",
  financialConceptId: "concept-1",
  costCenterId: "cost-center-1",
  type: "FIXED",
  amount: 3500,
  dayOfMonth: 10,
  status: "ACTIVE",
}

describe("recurring payment HTTP validation", () => {
  it("accepts a fixed recurrence with its cost center and no payment method", async () => {
    const response = makeResponse()
    const next = jest.fn()
    await validateRecurringPaymentConfiguration(
      { body: configuration } as never,
      response as never,
      next
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(response.send).not.toHaveBeenCalled()
  })

  it("accepts an optional PIX destination without turning it into a method", async () => {
    const response = makeResponse()
    const next = jest.fn()
    await validateRecurringPaymentConfiguration(
      {
        body: {
          ...configuration,
          pixDestination: {
            pixKey: "finance@example.org",
            pixKeyType: "EMAIL",
          },
        },
      } as never,
      response as never,
      next
    )

    expect(next).toHaveBeenCalledTimes(1)
  })

  it("rejects a recurrence without a cost center", async () => {
    const response = makeResponse()
    const next = jest.fn()
    const { costCenterId, ...withoutCostCenter } = configuration
    await validateRecurringPaymentConfiguration(
      { body: withoutCostCenter } as never,
      response as never,
      next
    )

    expect(response.status).toHaveBeenCalledWith(422)
    expect(next).not.toHaveBeenCalled()
  })

  it("rejects a permanent payment method in the configuration", async () => {
    const response = makeResponse()
    const next = jest.fn()
    await validateRecurringPaymentConfiguration(
      {
        body: { ...configuration, payment: { method: "PIX" } },
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

  it("rejects fields outside the configuration contract", async () => {
    const response = makeResponse()
    const next = jest.fn()
    await validateRecurringPaymentConfiguration(
      { body: { ...configuration, lastPayment: "2026-10-01" } } as never,
      response as never,
      next
    )

    expect(response.status).toHaveBeenCalledWith(422)
    expect(next).not.toHaveBeenCalled()
  })

  it("rejects a permanent amount on a variable recurrence", async () => {
    const response = makeResponse()
    const next = jest.fn()
    await validateRecurringPaymentConfiguration(
      {
        body: { ...configuration, type: "VARIABLE", amount: 10 },
      } as never,
      response as never,
      next
    )

    expect(response.status).toHaveBeenCalledWith(422)
    expect(next).not.toHaveBeenCalled()
  })

  describe("pay", () => {
    it("accepts a command with an explicit PIX method", async () => {
      const response = makeResponse()
      const next = jest.fn()
      await validatePayRecurringPayment(
        {
          body: {
            competence: "2026-10",
            payment: { type: "PIX", pixKey: "k", pixKeyType: "CNPJ" },
          },
        } as never,
        response as never,
        next
      )

      expect(next).toHaveBeenCalledTimes(1)
    })

    it("accepts a command with an explicit bill method", async () => {
      const response = makeResponse()
      const next = jest.fn()
      await validatePayRecurringPayment(
        {
          body: {
            competence: "2026-10",
            amount: 742.83,
            payment: { type: "BILL", identificationField: "34191..." },
          },
        } as never,
        response as never,
        next
      )

      expect(next).toHaveBeenCalledTimes(1)
    })

    it("accepts an execution that relies on the stored PIX destination", async () => {
      const response = makeResponse()
      const next = jest.fn()
      await validatePayRecurringPayment(
        { body: { competence: "2026-10" } } as never,
        response as never,
        next
      )

      expect(next).toHaveBeenCalledTimes(1)
    })

    it("accepts an explicit availability account", async () => {
      const response = makeResponse()
      const next = jest.fn()
      await validatePayRecurringPayment(
        {
          body: {
            competence: "2026-10",
            availabilityAccountId: "availability-2",
          },
        } as never,
        response as never,
        next
      )

      expect(next).toHaveBeenCalledTimes(1)
    })

    it("rejects a PIX method without a key or with an unknown key type", async () => {
      for (const payment of [
        { type: "PIX", pixKeyType: "CNPJ" },
        { type: "PIX", pixKey: "  ", pixKeyType: "CNPJ" },
        { type: "PIX", pixKey: "k", pixKeyType: "IBAN" },
      ]) {
        const response = makeResponse()
        const next = jest.fn()
        await validatePayRecurringPayment(
          { body: { competence: "2026-10", payment } } as never,
          response as never,
          next
        )
        expect(response.status).toHaveBeenCalledWith(422)
        expect(next).not.toHaveBeenCalled()
      }
    })

    it("rejects a bill method without an identification field", async () => {
      const response = makeResponse()
      const next = jest.fn()
      await validatePayRecurringPayment(
        {
          body: { competence: "2026-10", payment: { type: "BILL" } },
        } as never,
        response as never,
        next
      )

      expect(response.status).toHaveBeenCalledWith(422)
      expect(next).not.toHaveBeenCalled()
    })

    it("rejects an unknown payment method", async () => {
      const response = makeResponse()
      const next = jest.fn()
      await validatePayRecurringPayment(
        {
          body: { competence: "2026-10", payment: { type: "TED" } },
        } as never,
        response as never,
        next
      )

      expect(response.status).toHaveBeenCalledWith(422)
      expect(next).not.toHaveBeenCalled()
    })

    it("rejects competence outside YYYY-MM format", async () => {
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

  describe("bill/simulate", () => {
    it("accepts exactly one of the typed line or the barcode", async () => {
      for (const body of [
        { identificationField: "0339920159510052904014760030102388844" },
        { barCode: "03391815100000029909777729900000000475110101" },
      ]) {
        const response = makeResponse()
        const next = jest.fn()
        await validateSimulateRecurringPaymentBill(
          { body } as never,
          response as never,
          next
        )

        expect(next).toHaveBeenCalledTimes(1)
        expect(response.send).not.toHaveBeenCalled()
      }
    })

    it.each([
      ["both identifiers", { identificationField: "line", barCode: "code" }],
      ["neither identifier", {}],
      ["a blank typed line", { identificationField: "  " }],
      ["a blank barcode", { barCode: "" }],
      ["an amount", { identificationField: "line", amount: 742.83 }],
      [
        "an amount in cents",
        { identificationField: "line", amountInCents: 74283 },
      ],
      ["a church", { identificationField: "line", churchId: "church-2" }],
      [
        "an external account",
        { identificationField: "line", externalAccountId: "church-2" },
      ],
      ["an unknown field", { identificationField: "line", foo: "bar" }],
    ])("rejects %s", async (_case, body) => {
      const response = makeResponse()
      const next = jest.fn()
      await validateSimulateRecurringPaymentBill(
        { body } as never,
        response as never,
        next
      )

      expect(response.status).toHaveBeenCalledWith(400)
      expect(response.send).toHaveBeenCalledWith({
        code: "RECURRING_PAYMENT_BILL_SIMULATION_PAYLOAD_INVALID",
      })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe("register-payment", () => {
    const body = {
      competence: "2026-10",
      paymentDate: "2026-10-30",
      availabilityAccountId: "availability-1",
    }

    it("accepts a manual registration", async () => {
      const response = makeResponse()
      const next = jest.fn()
      await validateRegisterRecurringPayment(
        { body } as never,
        response as never,
        next
      )

      expect(next).toHaveBeenCalledTimes(1)
    })

    it("accepts a variable manual registration with an amount", async () => {
      const response = makeResponse()
      const next = jest.fn()
      await validateRegisterRecurringPayment(
        { body: { ...body, amount: 742.83 } } as never,
        response as never,
        next
      )

      expect(next).toHaveBeenCalledTimes(1)
    })

    it("rejects a manual registration without a valid payment date", async () => {
      for (const paymentDate of [
        undefined,
        "30/10/2026",
        "2026-10-30T10:00:00Z",
      ]) {
        const response = makeResponse()
        const next = jest.fn()
        await validateRegisterRecurringPayment(
          { body: { ...body, paymentDate } } as never,
          response as never,
          next
        )
        expect(response.status).toHaveBeenCalledWith(422)
        expect(next).not.toHaveBeenCalled()
      }
    })

    it("rejects a manual registration without an availability account", async () => {
      const response = makeResponse()
      const next = jest.fn()
      const { availabilityAccountId, ...withoutAccount } = body
      await validateRegisterRecurringPayment(
        { body: withoutAccount } as never,
        response as never,
        next
      )

      expect(response.status).toHaveBeenCalledWith(422)
      expect(response.send).toHaveBeenCalledWith({
        code: "RECURRING_PAYMENT_REGISTER_PAYLOAD_INVALID",
      })
      expect(next).not.toHaveBeenCalled()
    })

    it("rejects accounting identifiers supplied by the client", async () => {
      for (const injected of [
        { costCenterId: "cost-center-1" },
        { financialConceptId: "concept-1" },
        { type: "OUTGO" },
      ]) {
        const response = makeResponse()
        const next = jest.fn()
        await validateRegisterRecurringPayment(
          { body: { ...body, ...injected } } as never,
          response as never,
          next
        )
        expect(response.status).toHaveBeenCalledWith(422)
        expect(next).not.toHaveBeenCalled()
      }
    })
  })
})
