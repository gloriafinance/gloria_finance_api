import { ExecuteRecurringPayment } from "@/Financial/applications/recurringPayments/ExecuteRecurringPayment"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"

const PIX_DESTINATION = {
  pixKey: "12345678000190",
  pixKeyType: "CNPJ" as const,
}

type SetupInput = {
  type?: "FIXED" | "VARIABLE"
  amount?: number
  pixDestination?: typeof PIX_DESTINATION
  currentPayment?: ReturnType<RecurringPayments["getCurrentPayment"]>
  paid?: boolean
  bankCount?: number
  bankConnected?: boolean
  accounts?: number
  conceptDisabled?: boolean
  conceptType?: string
  costCenterMissing?: boolean
  closedMonth?: boolean
}

function setup(input: SetupInput = {}) {
  const recurrence = RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Energy",
    type: input.type ?? "FIXED",
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    dayOfMonth: 10,
    ...(input.pixDestination ? { pixDestination: input.pixDestination } : {}),
    status: "ACTIVE",
    ...(input.currentPayment === undefined
      ? {}
      : { currentPayment: input.currentPayment }),
  })

  const callOrder: string[] = []
  const repository = {
    one: jest.fn().mockResolvedValue(recurrence),
    saveIfCurrentPaymentMatches: jest.fn(async () => {
      callOrder.push("reserve")
      return true
    }),
  }
  const financialRecords = {
    findRecurringPayment: jest
      .fn()
      .mockResolvedValue(input.paid ? {} : undefined),
    one: jest.fn().mockResolvedValue(input.paid ? {} : undefined),
  }
  const bank = {
    isActive: () => true,
    getBankId: () => "bank-1",
    isConnectedTo: () => input.bankConnected !== false,
  }
  const banks = {
    all: jest.fn().mockResolvedValue(input.bankCount === 0 ? [] : [bank]),
  }
  const accounts = Array.from({ length: input.accounts ?? 1 }, (_, index) => ({
    getAvailabilityAccountId: () => `availability-${index + 1}`,
    getSource: () => ({ bankId: "bank-1" }),
  }))
  const availabilityAccounts = {
    list: jest.fn().mockResolvedValue(accounts),
    one: jest.fn().mockResolvedValue(accounts[0]),
  }
  const banking = {
    createPixTransfer: jest.fn(async () => {
      callOrder.push("bank")
      return {
        externalAccountId: "church-1",
        externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
        status: "PENDING",
        context: {},
        amountInCents: 12345,
      }
    }),
    createBillPayment: jest.fn().mockResolvedValue({
      externalAccountId: "church-1",
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      status: "PENDING",
      context: {},
    }),
  }
  const concept = {
    isDisable: () => input.conceptDisabled === true,
    getType: () =>
      input.conceptType === undefined ? "OUTGO" : input.conceptType,
  }
  const financialConcepts = { one: jest.fn().mockResolvedValue(concept) }
  const financialConfiguration = {
    findCostCenterByCostCenterId: jest
      .fn()
      .mockResolvedValue(input.costCenterMissing === true ? undefined : {}),
  }
  const financialYears = {
    one: jest
      .fn()
      .mockResolvedValue(
        input.closedMonth === true
          ? { isClosed: () => true }
          : { isClosed: () => false }
      ),
  }
  const queue = { dispatch: jest.fn() }
  const receipt = {
    storeRemoteReceipt: jest.fn().mockResolvedValue("stored-receipt"),
  }

  const service = new ExecuteRecurringPayment(
    repository as never,
    financialRecords as never,
    banks as never,
    availabilityAccounts as never,
    financialConcepts as never,
    financialConfiguration as never,
    financialYears as never,
    banking as never,
    receipt as never,
    queue as never,
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
    callOrder,
  }
}

describe("ExecuteRecurringPayment", () => {
  it("atomically reserves a fixed PIX payment before calling church-banking", async () => {
    const ctx = setup({ amount: 123.45, pixDestination: PIX_DESTINATION })
    const result = await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
    })

    expect(result).toEqual({ status: "PROCESSING", competence: "2026-10" })
    expect(ctx.callOrder.slice(0, 2)).toEqual(["reserve", "bank"])
    expect(ctx.banking.createPixTransfer).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      amountInCents: 12345,
      pixKey: "12345678000190",
      pixKeyType: "CNPJ",
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
    const fixed = setup({ amount: 25, pixDestination: PIX_DESTINATION })
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
      payment: { type: "PIX", pixKey: "key-123", pixKeyType: "EVP" },
    })

    expect(variable.banking.createPixTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ amountInCents: 74283, pixKey: "key-123" })
    )
  })

  it("uses a new attempt and a new stable reference after a confirmed terminal failure", async () => {
    const failed = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 123.45,
      paymentMethod: "PIX" as const,
      executionDestination: "EVP:key-123",
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
      payment: { type: "PIX", pixKey: "key-123", pixKeyType: "EVP" },
    })

    expect(ctx.repository.saveIfCurrentPaymentMatches).toHaveBeenCalledWith(
      ctx.recurrence,
      failed
    )
    expect(
      ctx.banking.createPixTransfer.mock.calls[0]?.[0].externalReference
    ).toBe("urn:recurringPayment:recurring-1:2026-10:2")
    expect(ctx.recurrence.getCurrentPayment()).toMatchObject({ attempt: 2 })
  })

  it("reuses the same external reference when retrying a creation-unknown attempt", async () => {
    const current = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 123.45,
      paymentMethod: "PIX" as const,
      executionDestination: "EVP:key-123",
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "PROCESSING" as const,
      providerStatus: "CREATION_UNKNOWN",
      updatedAt: new Date("2026-09-30T12:01:00Z"),
    }
    const ctx = setup({ amount: 123.45, currentPayment: current })
    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      payment: { type: "PIX", pixKey: "key-123", pixKeyType: "EVP" },
    })

    // The attempt is reused verbatim: no increment, same reference, and the
    // persisted state still belongs to attempt 1.
    expect(ctx.recurrence.getCurrentPayment()).toMatchObject({
      attempt: 1,
      externalReference: current.externalReference,
    })
    expect(
      ctx.repository.saveIfCurrentPaymentMatches.mock.calls[0]?.[1]
    ).toMatchObject({
      attempt: 1,
      externalReference: current.externalReference,
    })
    expect(
      ctx.banking.createPixTransfer.mock.calls[0]?.[0].externalReference
    ).toBe(current.externalReference)
  })

  it("refuses a creation-unknown retry whose method payload differs", async () => {
    const current = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 123.45,
      paymentMethod: "PIX" as const,
      executionDestination: "EVP:key-123",
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "PROCESSING" as const,
      providerStatus: "CREATION_UNKNOWN",
      updatedAt: new Date("2026-09-30T12:01:00Z"),
    }
    const ctx = setup({ amount: 123.45, currentPayment: current })
    await expect(
      ctx.service.execute("church-1", "recurring-1", {
        competence: "2026-10",
        payment: {
          type: "BILL",
          identificationField: "8364000000744283004810080101234567890",
        },
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_IN_PROGRESS" })
    expect(ctx.banking.createBillPayment).not.toHaveBeenCalled()
  })

  it("refuses a creation-unknown retry that changes the PIX destination", async () => {
    const current = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 123.45,
      paymentMethod: "PIX" as const,
      executionDestination: "EVP:key-123",
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "PROCESSING" as const,
      providerStatus: "CREATION_UNKNOWN",
      updatedAt: new Date("2026-09-30T12:01:00Z"),
    }
    const ctx = setup({ amount: 123.45, currentPayment: current })

    await expect(
      ctx.service.execute("church-1", "recurring-1", {
        competence: "2026-10",
        payment: { type: "PIX", pixKey: "other-key", pixKeyType: "EVP" },
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_IN_PROGRESS" })
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
  })

  it("accepts a creation-unknown retry that repeats the identical PIX destination", async () => {
    const current = {
      competence: "2026-10",
      attempt: 1,
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      amount: 123.45,
      paymentMethod: "PIX" as const,
      executionDestination: "EVP:key-123",
      bankId: "bank-1",
      availabilityAccountId: "availability-1",
      status: "PROCESSING" as const,
      providerStatus: "CREATION_UNKNOWN",
      updatedAt: new Date("2026-09-30T12:01:00Z"),
    }
    const ctx = setup({ amount: 123.45, currentPayment: current })

    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      payment: { type: "PIX", pixKey: "key-123", pixKeyType: "EVP" },
    })

    expect(ctx.banking.createPixTransfer.mock.calls[0]?.[0].pixKey).toBe(
      "key-123"
    )
    expect(
      ctx.banking.createPixTransfer.mock.calls[0]?.[0].externalReference
    ).toBe(current.externalReference)
  })

  it("keeps creation-unknown protected and does not treat a timeout as failure", async () => {
    const ctx = setup({ amount: 25, pixDestination: PIX_DESTINATION })
    ctx.banking.createPixTransfer.mockRejectedValue(
      new ChurchBankingClientError(503, "CREATION_UNKNOWN")
    )

    const result = await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
    })

    expect(result).toEqual({ status: "PROCESSING", competence: "2026-10" })
    expect(ctx.recurrence.getCurrentPayment()).toMatchObject({
      status: "PROCESSING",
      providerStatus: "CREATION_UNKNOWN",
    })
  })

  it("maps a confirmed church-banking rejection to FAILED", async () => {
    const ctx = setup({ amount: 25, pixDestination: PIX_DESTINATION })
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
    const ctx = setup({
      amount: 25,
      pixDestination: PIX_DESTINATION,
      paid: true,
    })
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
    "does not start a second bank payment for an existing %s operation",
    async (status, providerStatus) => {
      const currentPayment = {
        competence: "2026-10",
        attempt: 1,
        externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
        amount: 25,
        paymentMethod: "PIX" as const,
        executionDestination: "EVP:key-123",
        executionDestination: "EVP:key-123",
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
      expect(ctx.repository.saveIfCurrentPaymentMatches).not.toHaveBeenCalled()
    }
  )

  it("rejects a second concurrent request when the atomic reservation loses", async () => {
    const ctx = setup({ amount: 25, pixDestination: PIX_DESTINATION })
    ctx.repository.saveIfCurrentPaymentMatches.mockResolvedValue(false)
    const winner = RecurringPayments.fromPrimitives({
      ...ctx.recurrence.toPrimitives(),
      currentPayment: {
        competence: "2026-10",
        attempt: 1,
        externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
        amount: 25,
        paymentMethod: "PIX",
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
      ctx.service.execute("church-1", "recurring-1", {
        competence: "2026-10",
        payment: { type: "PIX", pixKey: "key-1", pixKeyType: "EVP" },
      })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE",
    })
    expect(ctx.repository.saveIfCurrentPaymentMatches).not.toHaveBeenCalled()
  })

  it("refuses to execute when no bank is connected to the provider", async () => {
    const ctx = setup({ amount: 25, bankConnected: false })
    await expect(
      ctx.service.execute("church-1", "recurring-1", {
        competence: "2026-10",
        payment: { type: "PIX", pixKey: "key-1", pixKeyType: "EVP" },
      })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE",
    })
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
  })

  it.each([
    [
      "a disabled concept",
      { conceptDisabled: true },
      "RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID",
    ],
    [
      "a concept that is no longer OUTGO",
      { conceptType: "INCOME" },
      "RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID",
    ],
    [
      "a cost center that cannot be resolved",
      { costCenterMissing: true },
      "RECURRING_PAYMENT_COST_CENTER_INVALID",
    ],
  ] as const)(
    "refuses to move money when the recurrence points to %s",
    async (_label, overrides, expected) => {
      const ctx = setup({
        amount: 25,
        pixDestination: PIX_DESTINATION,
        ...overrides,
      })
      await expect(
        ctx.service.execute("church-1", "recurring-1", {
          competence: "2026-10",
        })
      ).rejects.toMatchObject({ name: expected })
      expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
      expect(ctx.banking.createBillPayment).not.toHaveBeenCalled()
    }
  )

  it("refuses to move money when the financial month of the competence is closed", async () => {
    const ctx = setup({
      amount: 25,
      pixDestination: PIX_DESTINATION,
      closedMonth: true,
    })
    await expect(
      ctx.service.execute("church-1", "recurring-1", { competence: "2026-10" })
    ).rejects.toBeDefined()
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
  })

  it("requires an explicit account when the church holds several", async () => {
    const ctx = setup({
      amount: 25,
      pixDestination: PIX_DESTINATION,
      accounts: 2,
    })
    await expect(
      ctx.service.execute("church-1", "recurring-1", { competence: "2026-10" })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE",
    })
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
  })

  it("uses the explicitly selected account", async () => {
    const ctx = setup({
      amount: 25,
      pixDestination: PIX_DESTINATION,
      accounts: 2,
    })
    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      availabilityAccountId: "availability-2",
    })
    expect(ctx.recurrence.getCurrentPayment()).toMatchObject({
      availabilityAccountId: "availability-2",
    })
  })

  it("rejects an unknown availability account", async () => {
    const ctx = setup({ amount: 25, pixDestination: PIX_DESTINATION })
    await expect(
      ctx.service.execute("church-1", "recurring-1", {
        competence: "2026-10",
        availabilityAccountId: "availability-unknown",
      })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE",
    })
  })

  it("refuses to execute a fixed payment without a method or a stored PIX destination", async () => {
    const ctx = setup({ amount: 25 })
    await expect(
      ctx.service.execute("church-1", "recurring-1", { competence: "2026-10" })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_INVALID" })
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
    expect(ctx.banking.createBillPayment).not.toHaveBeenCalled()
  })

  it("executes a bill chosen at payment time even when the recurrence has no method", async () => {
    const ctx = setup({ amount: 742.83 })
    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      payment: {
        type: "BILL",
        identificationField:
          "83640000007 4 42830048100 8 01012345678 9 00000000000 0",
      },
    })
    expect(ctx.banking.createBillPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        identificationField:
          "83640000007 4 42830048100 8 01012345678 9 00000000000 0",
        externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      })
    )
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
    expect(ctx.recurrence.getCurrentPayment()).toMatchObject({
      paymentMethod: "BILL",
    })
  })

  it("lets a recurrence with a stored PIX destination be paid by bill", async () => {
    const ctx = setup({ amount: 742.83, pixDestination: PIX_DESTINATION })
    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      payment: {
        type: "BILL",
        identificationField: "83640000007442830048100801012345678900000000000",
      },
    })
    expect(ctx.banking.createBillPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        identificationField: "83640000007442830048100801012345678900000000000",
      })
    )
    expect(ctx.banking.createPixTransfer).not.toHaveBeenCalled()
  })

  it("rejects a bill whose answered amount differs from the reserved one", async () => {
    const ctx = setup({ amount: 742.83 })
    ctx.banking.createBillPayment.mockResolvedValue({
      externalAccountId: "church-1",
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      status: "PENDING",
      context: {},
      valueInCents: 78243,
    })

    await expect(
      ctx.service.execute("church-1", "recurring-1", {
        competence: "2026-10",
        payment: { type: "BILL", identificationField: "34191..." },
      })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BILL_AMOUNT_MISMATCH",
    })
  })

  it("accepts a bill whose answered amount matches the reserved one", async () => {
    const ctx = setup({ amount: 742.83 })
    ctx.banking.createBillPayment.mockResolvedValue({
      externalAccountId: "church-1",
      externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
      status: "PENDING",
      context: {},
      valueInCents: 74283,
    })

    const result = await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      payment: { type: "BILL", identificationField: "34191..." },
    })

    expect(result.status).toBe("PROCESSING")
  })

  it("does not leak the internal amount expectation to the provider payload", async () => {
    const ctx = setup({ amount: 742.83 })
    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      payment: { type: "BILL", identificationField: "34191..." },
    })

    const payload = ctx.banking.createBillPayment.mock.calls[0]?.[0]
    expect(payload).not.toHaveProperty("expectedValueInCents")
    expect(payload).toMatchObject({ identificationField: "34191..." })
  })

  it("executes a variable bill using the per-competence amount and code", async () => {
    const ctx = setup({ type: "VARIABLE" })
    await ctx.service.execute("church-1", "recurring-1", {
      competence: "2026-10",
      amount: 742.83,
      payment: {
        type: "BILL",
        identificationField: "83640000007442830048100801012345678900000000000",
      },
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
