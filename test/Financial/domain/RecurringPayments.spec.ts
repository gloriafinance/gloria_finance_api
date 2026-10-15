import { RecurringPayments } from "@/Financial/domain/RecurringPayments"

const base = {
  churchId: "church-1",
  financialConceptId: "concept-1",
  costCenterId: "cost-center-1",
  name: "Aluguel",
  dayOfMonth: 10,
  status: "ACTIVE" as const,
}

describe("RecurringPayments", () => {
  it("creates a fixed recurrence with its configured amount and cost center", () => {
    const recurrence = RecurringPayments.create({
      ...base,
      type: "FIXED",
      amount: 3500,
      pixDestination: {
        pixKey: "finance@example.org",
        pixKeyType: "EMAIL",
      },
    })

    expect(recurrence.getAmount()).toBe(3500)
    expect(recurrence.getCostCenterId()).toBe("cost-center-1")
    expect(recurrence.getPixDestination()).toEqual({
      pixKey: "finance@example.org",
      pixKeyType: "EMAIL",
    })
    expect(recurrence.getCurrentPayment()).toBeUndefined()
  })

  it("creates a variable recurrence without a permanent amount", () => {
    const recurrence = RecurringPayments.create({ ...base, type: "VARIABLE" })

    expect(recurrence.getAmount()).toBeUndefined()
    expect(recurrence.getPixDestination()).toBeUndefined()
  })

  it("keeps the PIX destination independent from any payment method", () => {
    const recurrence = RecurringPayments.create({
      ...base,
      type: "VARIABLE",
      pixDestination: { pixKey: "pix-key", pixKeyType: "EVP" },
    })

    // A stored destination is metadata about the payee; it is not a method.
    expect(recurrence.getPixDestination()).toEqual({
      pixKey: "pix-key",
      pixKeyType: "EVP",
    })
    expect(JSON.stringify(recurrence.toConfiguration())).not.toContain("method")
  })

  it("rejects a FIXED recurrence without a positive amount", () => {
    expect(() => RecurringPayments.create({ ...base, type: "FIXED" })).toThrow(
      expect.objectContaining({
        name: "RECURRING_PAYMENT_FIXED_AMOUNT_REQUIRED",
      })
    )
    expect(() =>
      RecurringPayments.create({ ...base, type: "FIXED", amount: 0 })
    ).toThrow(
      expect.objectContaining({
        name: "RECURRING_PAYMENT_FIXED_AMOUNT_REQUIRED",
      })
    )
  })

  it("rejects a permanent amount on a VARIABLE recurrence", () => {
    expect(() =>
      RecurringPayments.create({ ...base, type: "VARIABLE", amount: 10 })
    ).toThrow(
      expect.objectContaining({
        name: "RECURRING_PAYMENT_VARIABLE_AMOUNT_FORBIDDEN",
      })
    )
  })

  it("rejects an out-of-range day of month", () => {
    expect(() =>
      RecurringPayments.create({ ...base, type: "VARIABLE", dayOfMonth: 0 })
    ).toThrow(
      expect.objectContaining({
        name: "RECURRING_PAYMENT_DAY_OF_MONTH_INVALID",
      })
    )
    expect(() =>
      RecurringPayments.create({ ...base, type: "VARIABLE", dayOfMonth: 32 })
    ).toThrow(
      expect.objectContaining({
        name: "RECURRING_PAYMENT_DAY_OF_MONTH_INVALID",
      })
    )
  })

  it("rejects an empty PIX key or an unknown key type", () => {
    expect(() =>
      RecurringPayments.create({
        ...base,
        type: "VARIABLE",
        pixDestination: { pixKey: "   ", pixKeyType: "EVP" },
      })
    ).toThrow(
      expect.objectContaining({ name: "RECURRING_PAYMENT_PIX_KEY_REQUIRED" })
    )
    expect(() =>
      RecurringPayments.create({
        ...base,
        type: "VARIABLE",
        pixDestination: { pixKey: "k", pixKeyType: "IBAN" as never },
      })
    ).toThrow(
      expect.objectContaining({ name: "RECURRING_PAYMENT_PIX_KEY_REQUIRED" })
    )
  })

  it("validates the configuration it is updated with", () => {
    const recurrence = RecurringPayments.create({
      ...base,
      type: "FIXED",
      amount: 3500,
    })

    expect(() =>
      recurrence.updateConfiguration({
        ...base,
        type: "FIXED",
        amount: 0,
      })
    ).toThrow(
      expect.objectContaining({
        name: "RECURRING_PAYMENT_FIXED_AMOUNT_REQUIRED",
      })
    )
    expect(recurrence.getAmount()).toBe(3500)
  })

  it("refuses to change the configuration while a payment is in flight", () => {
    const recurrence = RecurringPayments.create({
      ...base,
      type: "FIXED",
      amount: 3500,
    })
    recurrence.reserveCurrentPayment({
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 3500,
      paymentMethod: "PIX",
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "PROCESSING",
      providerStatus: "PENDING",
      updatedAt: new Date("2026-10-01T12:00:00Z"),
    })

    expect(() =>
      recurrence.updateConfiguration({ ...base, type: "FIXED", amount: 10 })
    ).toThrow(
      expect.objectContaining({ name: "RECURRING_PAYMENT_IN_PROGRESS" })
    )
  })

  it("rejects a second reservation while an operation is in flight", () => {
    const recurrence = RecurringPayments.create({
      ...base,
      type: "FIXED",
      amount: 3500,
    })
    const payment = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 3500,
      paymentMethod: "PIX" as const,
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "PROCESSING" as const,
      providerStatus: "PENDING",
      updatedAt: new Date("2026-10-01T12:00:00Z"),
    }
    recurrence.reserveCurrentPayment(payment)

    expect(() => recurrence.reserveCurrentPayment(payment)).toThrow(
      expect.objectContaining({ name: "RECURRING_PAYMENT_IN_PROGRESS" })
    )
  })
})
