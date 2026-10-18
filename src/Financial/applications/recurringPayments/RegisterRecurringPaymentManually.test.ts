import { describe, expect, it, jest } from "@jest/globals"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { RegisterRecurringPaymentManually } from "./RegisterRecurringPaymentManually"

function bankingCurrentPayment(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    competence: "2026-10",
    externalReference: "urn:recurringPayment:recurring-1:2026-10",
    amount: 100,
    paymentMethod: "PIX_QR",
    executionDestination: "PIX_QR:hash",
    bankId: "bank-1",
    availabilityAccountId: "asaas-account",
    status: "PROCESSING",
    providerPaymentReserved: true,
    updatedAt: new Date("2026-10-17T12:00:00.000Z"),
    ...overrides,
  }
}

function build(
  options: {
    currentPayment?: Record<string, unknown>
    existingRecord?: boolean
    inactive?: boolean
    requiresCostCenter?: boolean
    type?: "FIXED" | "VARIABLE"
    amount?: number | null
    registrarThrows?: boolean
  } = {}
) {
  const recurring = RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Alquiler",
    type: options.type ?? "FIXED",
    ...(options.amount === null ? {} : { amount: options.amount ?? 100 }),
    dayOfMonth: 10,
    status: "ACTIVE",
    ...(options.requiresCostCenter ? { requiresCostCenter: true } : {}),
    ...(options.currentPayment
      ? { currentPayment: options.currentPayment as never }
      : {}),
  })
  const recordRegistrar = {
    execute: jest.fn(async (..._args: unknown[]) => {
      if (options.registrarThrows) throw new Error("queue down")
      return undefined
    }),
  }
  const storage = {
    uploadFile: jest.fn(async (..._args: unknown[]) => "voucher-key"),
    deleteFile: jest.fn(async (..._args: unknown[]) => undefined),
  }
  const useCase = new RegisterRecurringPaymentManually(
    {
      one: jest.fn(async () => (options.inactive ? undefined : recurring)),
    } as never,
    {
      findRecurringPayment: jest.fn(async () =>
        options.existingRecord ? { id: "record-1" } : undefined
      ),
    } as never,
    storage as never,
    recordRegistrar as never
  )
  return { useCase, recordRegistrar, storage }
}

const request = {
  competence: "2026-10",
  paymentDate: "2026-10-17",
  availabilityAccountId: "cash-account",
}
const file = { originalname: "comprobante.pdf" }

describe("RegisterRecurringPaymentManually", () => {
  it("blocks the manual registration while the same competence has a banking payment in progress", async () => {
    const { useCase, recordRegistrar } = build({
      currentPayment: bankingCurrentPayment(),
    })

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", request)
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_IN_PROGRESS" })
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
  })

  it("registers the payment when the banking payment for this competence FAILED", async () => {
    const { useCase, recordRegistrar } = build({
      currentPayment: bankingCurrentPayment({ status: "FAILED" }),
    })

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", request)
    ).resolves.toMatchObject({ status: "PROCESSING" })
    expect(recordRegistrar.execute).toHaveBeenCalledTimes(1)
  })

  it("registers the payment when the banking payment belongs to another competence", async () => {
    const { useCase, recordRegistrar } = build({
      currentPayment: bankingCurrentPayment({ competence: "2026-09" }),
    })

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", request)
    ).resolves.toMatchObject({ status: "PROCESSING" })
    expect(recordRegistrar.execute).toHaveBeenCalledTimes(1)
  })

  it("registers a CASH payment without a voucher when no banking payment exists", async () => {
    const { useCase, recordRegistrar } = build()

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", request)
    ).resolves.toMatchObject({ status: "PROCESSING" })
    expect(recordRegistrar.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 100,
        availabilityAccountId: "cash-account",
      })
    )
  })

  it("uploads the voucher and hands it to the record registrar", async () => {
    const { useCase, storage, recordRegistrar } = build()

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", { ...request, file })
    ).resolves.toMatchObject({ status: "PROCESSING" })
    expect(storage.uploadFile).toHaveBeenCalledWith(file)
    expect(recordRegistrar.execute).toHaveBeenCalledWith(
      expect.objectContaining({ voucher: "voucher-key" })
    )
  })

  it("does not register again when the competence already has a record", async () => {
    const { useCase, recordRegistrar } = build({ existingRecord: true })

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", request)
    ).resolves.toEqual({ status: "ALREADY_REGISTERED", competence: "2026-10" })
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
  })

  it("refuses to register against an inactive recurrence", async () => {
    const { useCase, recordRegistrar } = build({ inactive: true })

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", request)
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_NOT_FOUND" })
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
  })

  it("rejects a competence outside the YYYY-MM format", async () => {
    const { useCase } = build()

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", {
        ...request,
        competence: "2026-13",
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_INVALID" })
  })

  it("stops when the recurrence has no cost center to allocate the expense", async () => {
    const { useCase, recordRegistrar } = build({ requiresCostCenter: true })

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", request)
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_COST_CENTER_INVALID",
    })
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
  })

  it("rejects an amount supplied for a FIXED recurrence", async () => {
    const { useCase } = build()

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", {
        ...request,
        amount: 10,
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_AMOUNT_FORBIDDEN" })
  })

  it("requires the amount actually paid for a VARIABLE recurrence", async () => {
    const { useCase, recordRegistrar } = build({
      type: "VARIABLE",
      amount: null,
    })

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", request)
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_AMOUNT_REQUIRED" })
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
  })

  it("removes the uploaded voucher when the record cannot be scheduled", async () => {
    const { useCase, storage } = build({ registrarThrows: true })

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", { ...request, file })
    ).rejects.toThrow("queue down")
    expect(storage.deleteFile).toHaveBeenCalledWith("voucher-key")
  })
})
