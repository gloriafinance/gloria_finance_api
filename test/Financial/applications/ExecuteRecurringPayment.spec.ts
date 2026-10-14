import { ExecuteRecurringPayment } from "@/Financial/applications/recurringPayments/ExecuteRecurringPayment"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { ChurchBankingClientError } from "@/Banking/domain"

const PIX = {
  method: "PIX" as const,
  pixKey: "key-123",
  pixKeyType: "EVP" as const,
}
const bill = { method: "BILL" as const }

function setup(input: {
  type?: "FIXED" | "VARIABLE"
  amount?: number
  payment?: typeof PIX | typeof bill
  currentPayment?: ReturnType<RecurringPayments["getCurrentPayment"]>
  paid?: boolean
  bankCount?: number
}) {
  const recurrence = RecurringPayments.fromPrimitives({
    recurringPaymentsId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    name: "Energy",
    type: input.type ?? "FIXED",
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    dayOfMonth: 10,
    payment: input.payment ?? PIX,
    status: "ACTIVE",
    ...(input.currentPayment === undefined
      ? {}
      : { currentPayment: input.currentPayment }),
  })
  const repository = {
    one: jest.fn().mockResolvedValue(recurrence),
    reservePayment: jest.fn().mockResolvedValue(true),
    updateCurrentPayment: jest.fn().mockResolvedValue(true),
    confirmCurrentPayment: jest.fn().mockResolvedValue(true),
  }
  const financialRecords = {
    findRecurringPayment: jest
      .fn()
      .mockResolvedValue(input.paid ? {} : undefined),
  }
  const concept = {
    getChurchId: () => "church-1",
    isDisable: () => false,
    getType: () => "OUTGO",
  }
  const financialConcepts = { one: jest.fn().mockResolvedValue(concept) }
  const bank = { isActive: () => true, getBankId: () => "bank-1" }
  const banks = {
    all: jest.fn().mockResolvedValue(input.bankCount === 0 ? [] : [bank]),
  }
  const account = {
    getAvailabilityAccountId: () => "availability-1",
    getSource: () => ({ bankId: "bank-1" }),
  }
  const availabilityAccounts = {
    list: jest.fn().mockResolvedValue([account]),
    one: jest.fn(),
  }
  const banking = {
    createPixTransfer: jest.fn().mockResolvedValue({
      externalAccountId: "church-1",
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      status: "PENDING",
      context: {},
      amountInCents: 12345,
    }),
    createBillPayment: jest.fn().mockResolvedValue({
      externalAccountId: "church-1",
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      status: "PENDING",
      context: {},
    }),
  }
  const queue = { dispatch: jest.fn() }
  const receipt = { save: jest.fn() }
  const service = new ExecuteRecurringPayment(
    repository as never,
    financialRecords as never,
    financialConcepts as never,
    banks as never,
    availabilityAccounts as never,
    banking as never,
    queue as never,
    receipt as never,
    () => new Date("2026-10-01T12:00:00Z")
  )
  return {
    service,
    recurrence,
    repository,
    financialRecords,
    banking,
    banks,
    availabilityAccounts,
    queue,
  }
}

describe("ExecuteRecurringPayment", () => {
  it("atomically reserves a fixed PIX payment before calling church-banking", async () => {
    const ctx = setup({ amount: 123.45 })
    const result = await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
    })

    expect(result).toEqual({ status: "PROCESSING", competence: "2026-10" })
    expect(
      ctx.repository.reservePayment.mock.invocationCallOrder[0]
    ).toBeLessThan(ctx.banking.createPixTransfer.mock.invocationCallOrder[0])
    expect(ctx.banking.createPixTransfer).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      amountInCents: 12345,
      pixKey: "key-123",
      pixKeyType: "EVP",
      description: "Energy",
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      context: {
        source: "RECURRING_PAYMENT",
        recurringPaymentId: "recurring-1",
        competence: "2026-10",
        attempt: 1,
      },
    })
  })

  it("uses the persisted amount for fixed payments and requires an amount for variable payments", async () => {
    const fixed = setup({ amount: 25 })
    await expect(
      fixed.service.execute("church-1", "recurring-1", {
        competence: "2026-10",
        amount: 25,
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_AMOUNT_FORBIDDEN" })

    const variable = setup({ type: "VARIABLE" })
    await expect(
      variable.service.execute("church-1", "recurring-1", {
        competence: "2026-10",
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_AMOUNT_REQUIRED" })
    expect(variable.banking.createPixTransfer).not.toHaveBeenCalled()
  })

  it("executes a variable PIX payment using the amount for that competence", async () => {
    const variable = setup({ type: "VARIABLE" })
    await variable.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      amount: 742.83,
    })

    expect(variable.banking.createPixTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ amountInCents: 74283 })
    )
  })

  it("uses a new attempt and stable reference after a confirmed terminal failure", async () => {
    const failed = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 123.45,
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "FAILED" as const,
      providerStatus: "FAILED",
      updatedAt: new Date("2026-09-30T12:01:00Z"),
    }
    const ctx = setup({ amount: 123.45, currentPayment: failed })
    ctx.banking.createPixTransfer.mockResolvedValue({
      externalAccountId: "church-1",
      externalReference: "urn:recurringPayment:recurring-1:2026-10:2",
      status: "PENDING",
      context: {},
      amountInCents: 12345,
    })

    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
    })

    expect(ctx.repository.reservePayment).toHaveBeenCalledWith(
      "recurring-1",
      failed,
      expect.objectContaining({
        attempt: 2,
        externalReference: "urn:recurringPayment:recurring-1:2026-10:2",
      })
    )
    expect(
      ctx.banking.createPixTransfer.mock.calls[0]?.[0].externalReference
    ).toBe("urn:recurringPayment:recurring-1:2026-10:2")
  })

  it("reuses the same external reference when retrying a creation-unknown attempt", async () => {
    const current = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 123.45,
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "PROCESSING" as const,
      providerStatus: "CREATION_UNKNOWN",
      updatedAt: new Date("2026-09-30T12:01:00Z"),
    }
    const ctx = setup({ amount: 123.45, currentPayment: current })
    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
    })

    expect(ctx.repository.reservePayment).not.toHaveBeenCalled()
    expect(
      ctx.banking.createPixTransfer.mock.calls[0]?.[0].externalReference
    ).toBe(current.externalReference)
  })

  it("keeps creation-unknown protected and does not treat a timeout as failure", async () => {
    const ctx = setup({ amount: 25 })
    ctx.banking.createPixTransfer.mockRejectedValue(
      new ChurchBankingClientError(503, "CREATION_UNKNOWN")
    )

    const result = await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
    })

    expect(result).toEqual({ status: "PROCESSING", competence: "2026-10" })
    expect(ctx.repository.updateCurrentPayment).toHaveBeenCalledWith(
      "recurring-1",
      "urn:recurringPayment:recurring-1:2026-10:1",
      expect.any(Date),
      expect.objectContaining({
        status: "PROCESSING",
        providerStatus: "CREATION_UNKNOWN",
      })
    )
  })

  it("maps a confirmed church-banking rejection to FAILED", async () => {
    const ctx = setup({ amount: 25 })
    ctx.banking.createPixTransfer.mockRejectedValue(
      new ChurchBankingClientError(422, "PIX_KEY_INVALID")
    )

    const result = await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
    })

    expect(result).toMatchObject({
      status: "FAILED",
      competence: "2026-10",
      failureCode: "PIX_KEY_INVALID",
    })
  })

  it("does not call church-banking when the competence already has a financial record", async () => {
    const ctx = setup({ amount: 25, paid: true })
    const result = await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
    })
    expect(result).toEqual({ status: "ALREADY_PAID", competence: "2026-10" })
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
  })

  it.each([
    ["PROCESSING", "PENDING"],
    ["BLOCKED", "BLOCKED"],
  ] as const)(
    "does not start a second bank payment for existing %s operation",
    async (status, providerStatus) => {
      const currentPayment = {
        competence: "2026-10",
        attempt: 1,
        externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
        amount: 25,
        bankId: "bank-1",
        availabilityAccountId: "availability-1",
        status,
        providerStatus,
        updatedAt: new Date("2026-10-01T10:01:00Z"),
      }
      const ctx = setup({ amount: 25, currentPayment })

      const result = await ctx.service.execute("church-1", "recurring-1", {
        competence: "2026-10",
      })

      expect(result.status).toBe(status)
      expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
      expect(ctx.repository.reservePayment).not.toHaveBeenCalled()
    }
  )

  it("rejects a second concurrent request when the atomic reservation loses", async () => {
    const ctx = setup({ amount: 25 })
    ctx.repository.reservePayment.mockResolvedValue(false)
    const winner = RecurringPayments.fromPrimitives({
      ...ctx.recurrence.toPrimitives(),
      currentPayment: {
        competence: "2026-10",
        attempt: 1,
        externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
        amount: 25,
        bankId: "bank-1",
        availabilityAccountId: "availability-1",
        status: "PROCESSING",
        providerStatus: "PENDING",
        updatedAt: new Date(),
      },
    })
    ctx.repository.one
      .mockResolvedValueOnce(ctx.recurrence)
      .mockResolvedValueOnce(winner)

    const result = await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
    })
    expect(result.status).toBe("PROCESSING")
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
  })

  it("requires a connected banking account before reserving payment", async () => {
    const ctx = setup({ amount: 25, bankCount: 0 })
    await expect(
      ctx.service.execute("church-1", "recurring-1", { competence: "2026-10" })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE",
    })
    expect(ctx.repository.reservePayment).not.toHaveBeenCalled()
  })

  it("requires and sends the per-competence bill identification field", async () => {
    const ctx = setup({ amount: 742.83, payment: bill })
    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      identificationField:
        "83640000007 4 42830048100 8 01012345678 9 00000000000 0",
    })
    expect(ctx.banking.createBillPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        identificationField:
          "83640000007 4 42830048100 8 01012345678 9 00000000000 0",
        externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      })
    )
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
  })

  it("executes a variable bill using the per-competence amount and code", async () => {
    const ctx = setup({ type: "VARIABLE", payment: bill })
    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      amount: 742.83,
      identificationField: "83640000007442830048100801012345678900000000000",
    })

    expect(ctx.banking.createBillPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        identificationField: "83640000007442830048100801012345678900000000000",
        externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      })
    )
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
  })
})
