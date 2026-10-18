import { describe, expect, it, jest } from "@jest/globals"
import { AccountType } from "@/FinanceConfig/domain/enums/AccountType.enum"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { RegisterRecurringPaymentManually } from "./RegisterRecurringPaymentManually"

function recurringWithCurrentPayment() {
  return RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Alquiler",
    type: "FIXED",
    amount: 100,
    dayOfMonth: 10,
    status: "ACTIVE",
    currentPayment: {
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
    },
  })
}

function build(options: { activePayment?: boolean } = {}) {
  const recurring = options.activePayment
    ? recurringWithCurrentPayment()
    : RecurringPayments.fromPrimitives({
        recurringPaymentId: "recurring-1",
        churchId: "church-1",
        financialConceptId: "concept-1",
        costCenterId: "cost-center-1",
        name: "Alquiler",
        type: "FIXED",
        amount: 100,
        dayOfMonth: 10,
        status: "ACTIVE",
      })
  const recordRegistrar = { execute: jest.fn(async () => undefined) }
  const useCase = new RegisterRecurringPaymentManually(
    { one: jest.fn(async () => recurring) } as never,
    { findRecurringPayment: jest.fn(async () => undefined) } as never,
    {
      one: jest.fn(async () => ({
        getType: () => AccountType.CASH,
        getAvailabilityAccountId: () => "cash-account",
      })),
    } as never,
    { findById: jest.fn() } as never,
    { uploadFile: jest.fn(), deleteFile: jest.fn() } as never,
    recordRegistrar as never
  )
  return { useCase, recordRegistrar }
}

const request = {
  competence: "2026-10",
  paymentDate: "2026-10-17",
  availabilityAccountId: "cash-account",
}

describe("RegisterRecurringPaymentManually", () => {
  it("blocks CASH registration while the same competence has a banking payment in progress", async () => {
    const { useCase, recordRegistrar } = build({ activePayment: true })

    await expect(
      useCase.execute("church-1", "recurring-1", "user-1", request)
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_IN_PROGRESS",
    })
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
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
})
