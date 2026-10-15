import { RegisterRecurringPaymentManually } from "@/Financial/applications/recurringPayments/RegisterRecurringPaymentManually"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"

type SetupInput = {
  type?: "FIXED" | "VARIABLE"
  amount?: number
  accountExists?: boolean
  alreadyRegistered?: boolean
}

function setup(input: SetupInput = {}) {
  const recurrence = RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Aluguel do templo",
    type: input.type ?? "FIXED",
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    dayOfMonth: 10,
    status: "ACTIVE",
  })

  const recurringRepository = {
    one: jest.fn().mockResolvedValue(recurrence),
  }
  const financialRecords = {
    findRecurringPayment: jest
      .fn()
      .mockResolvedValue(input.alreadyRegistered ? {} : undefined),
  }
  const account = {
    getAvailabilityAccountId: () => "availability-1",
    getAccountName: () => "Itaú",
    getType: () => "BANK",
    getSymbol: () => "R$",
  }
  const availabilityAccounts = {
    one: jest
      .fn()
      .mockResolvedValue(input.accountExists === false ? undefined : account),
  }
  const concept = { getFinancialConceptId: () => "concept-1" }
  const financialConcepts = { one: jest.fn().mockResolvedValue(concept) }
  const costCenter = {
    getCostCenterId: () => "cost-center-1",
    getCostCenterName: () => "Templo",
  }
  const financialConfiguration = {
    findCostCenterByCostCenterId: jest.fn().mockResolvedValue(costCenter),
  }
  const queue = { dispatch: jest.fn() }
  const storage = {
    uploadFile: jest.fn().mockResolvedValue("voucher-key"),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  }
  const service = new RegisterRecurringPaymentManually(
    recurringRepository as never,
    financialRecords as never,
    financialConcepts as never,
    financialConfiguration as never,
    availabilityAccounts as never,
    queue as never,
    storage as never
  )

  return {
    service,
    recurrence,
    recurringRepository,
    financialRecords,
    availabilityAccounts,
    financialConfiguration,
    queue,
    storage,
    file: { originalname: "comprovante.pdf" },
  }
}

const request = {
  competence: "2026-10",
  paymentDate: "2026-10-30",
  availabilityAccountId: "availability-1",
}

describe("RegisterRecurringPaymentManually", () => {
  it("requires a voucher before touching anything else", async () => {
    const ctx = setup({ amount: 3500 })
    await expect(
      ctx.service.execute("church-1", "recurring-1", "user-1", request)
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_VOUCHER_REQUIRED" })
    expect(ctx.storage.uploadFile).not.toHaveBeenCalled()
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it("uses the configured amount for a FIXED recurrence and settles it as pending reconciliation", async () => {
    const ctx = setup({ amount: 3500 })
    const result = await ctx.service.execute(
      "church-1",
      "recurring-1",
      "user-1",
      { ...request, file: ctx.file }
    )

    expect(result).toEqual({ status: "REGISTERED", competence: "2026-10" })
    expect(ctx.storage.uploadFile).toHaveBeenCalledWith(ctx.file)

    const [, args] = ctx.queue.dispatch.mock.calls[0]!
    expect(args).toMatchObject({
      amount: 3500,
      churchId: "church-1",
      financialRecordType: "OUTGO",
      source: "MANUAL",
      status: "PENDING",
      createdBy: "user-1",
      voucher: "voucher-key",
      recurringPaymentId: "recurring-1",
      recurringCompetence: "2026-10",
      reference: { type: "RECURRING_PAYMENT", entityId: "recurring-1" },
    })
    expect(args.availabilityAccount.getAvailabilityAccountId()).toBe(
      "availability-1"
    )
    // A manual payment was not executed by the bank.
    expect(args.bankingExternalReference).toBeUndefined()
    expect(ctx.recurrence.getCurrentPayment()).toBeUndefined()
  })

  it("requires the amount actually paid for a VARIABLE recurrence", async () => {
    const missing = setup({ type: "VARIABLE" })
    await expect(
      missing.service.execute("church-1", "recurring-1", "user-1", {
        ...request,
        file: missing.file,
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_AMOUNT_REQUIRED" })
    expect(missing.storage.uploadFile).not.toHaveBeenCalled()

    const provided = setup({ type: "VARIABLE" })
    await provided.service.execute("church-1", "recurring-1", "user-1", {
      ...request,
      amount: 742.83,
      file: provided.file,
    })
    expect(provided.queue.dispatch.mock.calls[0]?.[1]).toMatchObject({
      amount: 742.83,
    })
  })

  it("rejects an amount supplied for a FIXED recurrence", async () => {
    const ctx = setup({ amount: 3500 })
    await expect(
      ctx.service.execute("church-1", "recurring-1", "user-1", {
        ...request,
        amount: 10,
        file: ctx.file,
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_AMOUNT_FORBIDDEN" })
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it("returns already-registered without uploading a second voucher", async () => {
    const ctx = setup({ amount: 3500, alreadyRegistered: true })
    const result = await ctx.service.execute(
      "church-1",
      "recurring-1",
      "user-1",
      { ...request, file: ctx.file }
    )

    expect(result).toEqual({
      status: "ALREADY_REGISTERED",
      competence: "2026-10",
    })
    expect(ctx.storage.uploadFile).not.toHaveBeenCalled()
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it("rejects an availability account that does not belong to the church", async () => {
    const ctx = setup({ amount: 3500, accountExists: false })
    await expect(
      ctx.service.execute("church-1", "recurring-1", "user-1", {
        ...request,
        file: ctx.file,
      })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE",
    })
    expect(ctx.storage.uploadFile).not.toHaveBeenCalled()
  })

  it("rejects a competence outside YYYY-MM format", async () => {
    const ctx = setup({ amount: 3500 })
    await expect(
      ctx.service.execute("church-1", "recurring-1", "user-1", {
        ...request,
        competence: "2026-13",
        file: ctx.file,
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_INVALID" })
    expect(ctx.storage.uploadFile).not.toHaveBeenCalled()
  })

  it("removes the uploaded voucher when the record cannot be scheduled", async () => {
    const ctx = setup({ amount: 3500 })
    ctx.queue.dispatch.mockImplementation(() => {
      throw new Error("queue down")
    })

    await expect(
      ctx.service.execute("church-1", "recurring-1", "user-1", {
        ...request,
        file: ctx.file,
      })
    ).rejects.toThrow("queue down")
    expect(ctx.storage.deleteFile).toHaveBeenCalledWith("voucher-key")
  })

  it("resolves the cost center from the recurrence, not from the request", async () => {
    const ctx = setup({ amount: 3500 })
    await ctx.service.execute("church-1", "recurring-1", "user-1", {
      ...request,
      file: ctx.file,
    })
    const [, args] = ctx.queue.dispatch.mock.calls[0]!
    expect(args.costCenter.getCostCenterId()).toBe("cost-center-1")
    expect(args.financialConcept.getFinancialConceptId()).toBe("concept-1")
  })
})
