import { ProcessRecurringPaymentBankingUpdate } from "@/Webhook/infrastructure/services/ProcessRecurringPaymentBankingUpdate.service"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"

function setup(method: "PIX" | "BILL" = "PIX") {
  const currentPayment = {
    competence: "2026-10",
    attempt: 1,
    externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
    amount: 742.83,
    bankId: "bank-1",
    availabilityAccountId: "availability-1",
    status: "PROCESSING" as const,
    providerStatus: "PENDING",
    updatedAt: new Date("2026-10-01T10:01:00Z"),
  }
  const recurrence = RecurringPayments.fromPrimitives({
    recurringPaymentsId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    name: "Energy",
    type: "VARIABLE",
    dayOfMonth: 10,
    payment:
      method === "PIX"
        ? { method, pixKey: "key-1", pixKeyType: "EVP" }
        : { method },
    status: "ACTIVE",
    currentPayment,
  })
  const recurringRepository = {
    one: jest.fn().mockResolvedValue(recurrence),
    updateCurrentPayment: jest.fn().mockResolvedValue(true),
    confirmCurrentPayment: jest.fn().mockResolvedValue(true),
    closeCurrentPayment: jest.fn().mockResolvedValue(true),
  }
  const financialRecords = {
    findByBankingExternalReference: jest.fn().mockResolvedValue(undefined),
    findRecurringPayment: jest.fn().mockResolvedValue(undefined),
  }
  const concept = { getChurchId: () => "church-1" }
  const conceptRepository = { one: jest.fn().mockResolvedValue(concept) }
  const account = { getAvailabilityAccountId: () => "availability-1" }
  const availabilityAccounts = { one: jest.fn().mockResolvedValue(account) }
  const queue = { dispatch: jest.fn() }
  const receipt = { save: jest.fn().mockResolvedValue("receipt-key") }
  const service = new ProcessRecurringPaymentBankingUpdate(
    recurringRepository as never,
    financialRecords as never,
    conceptRepository as never,
    availabilityAccounts as never,
    queue as never,
    receipt as never,
    () => new Date("2026-10-01T12:00:00Z")
  )
  return {
    service,
    recurrence,
    currentPayment,
    recurringRepository,
    financialRecords,
    availabilityAccounts,
    queue,
    receipt,
  }
}

const context = {
  source: "RECURRING_PAYMENT",
  recurringPaymentId: "recurring-1",
  competence: "2026-10",
  attempt: 1,
}

describe("ProcessRecurringPaymentBankingUpdate", () => {
  it("updates a pending PIX operation without creating a financial record", async () => {
    const ctx = setup()
    await ctx.service.processPix({
      id: "event-1",
      type: "BANKING_PIX_TRANSFER_UPDATED",
      occurredAt: "2026-10-01T12:00:00Z",
      externalAccountId: "church-1",
      accountId: "bank-1",
      data: {
        pixTransfer: {
          providerTransferId: "transfer-1",
          status: "IN_BANK_PROCESSING",
          amountInCents: 74283,
          externalReference: ctx.currentPayment.externalReference,
          context,
          transactionReceiptUrl: null,
          failureCode: null,
        },
      },
    })
    expect(ctx.recurringRepository.updateCurrentPayment).toHaveBeenCalledWith(
      "recurring-1",
      ctx.currentPayment.externalReference,
      ctx.currentPayment.updatedAt,
      expect.objectContaining({
        status: "PROCESSING",
        providerStatus: "IN_BANK_PROCESSING",
      })
    )
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it.each([
    ["IN_BANK_PROCESSING", "PROCESSING"],
    ["BLOCKED", "BLOCKED"],
    ["FAILED", "FAILED"],
    ["CANCELLED", "FAILED"],
  ] as const)(
    "maps PIX provider status %s to %s without creating a record",
    async (providerStatus, expectedStatus) => {
      const ctx = setup()
      await ctx.service.processPix({
        id: `event-${providerStatus}`,
        type: "BANKING_PIX_TRANSFER_UPDATED",
        occurredAt: "2026-10-01T12:00:00Z",
        externalAccountId: "church-1",
        accountId: "bank-1",
        data: {
          pixTransfer: {
            providerTransferId: "transfer-1",
            status: providerStatus,
            amountInCents: 74283,
            externalReference: ctx.currentPayment.externalReference,
            context,
            transactionReceiptUrl: null,
            failureCode: null,
          },
        },
      })
      expect(ctx.recurringRepository.updateCurrentPayment).toHaveBeenCalledWith(
        "recurring-1",
        ctx.currentPayment.externalReference,
        ctx.currentPayment.updatedAt,
        expect.objectContaining({ status: expectedStatus })
      )
      expect(ctx.queue.dispatch).not.toHaveBeenCalled()
    }
  )

  it.each([
    ["PENDING", "PROCESSING"],
    ["BANK_PROCESSING", "PROCESSING"],
    ["FAILED", "FAILED"],
    ["CANCELLED", "FAILED"],
  ] as const)(
    "maps bill provider status %s to %s without creating a record",
    async (providerStatus, expectedStatus) => {
      const ctx = setup("BILL")
      await ctx.service.processBill({
        id: `event-${providerStatus}`,
        type: "BANKING_BILL_PAYMENT_UPDATED",
        occurredAt: "2026-10-01T12:00:00Z",
        externalAccountId: "church-1",
        accountId: "bank-1",
        data: {
          billPayment: {
            providerBillId: "bill-1",
            status: providerStatus,
            externalReference: ctx.currentPayment.externalReference,
            context,
            paymentDate: null,
            transactionReceiptUrl: null,
            failureCode: null,
          },
        },
      })
      expect(ctx.recurringRepository.updateCurrentPayment).toHaveBeenCalledWith(
        "recurring-1",
        ctx.currentPayment.externalReference,
        ctx.currentPayment.updatedAt,
        expect.objectContaining({ status: expectedStatus })
      )
      expect(ctx.queue.dispatch).not.toHaveBeenCalled()
    }
  )

  it("creates one reconciled OUTGO record for a confirmed PIX transfer", async () => {
    const ctx = setup()
    await ctx.service.processPix({
      id: "event-2",
      type: "BANKING_PIX_TRANSFER_UPDATED",
      occurredAt: "2026-10-01T12:00:00Z",
      externalAccountId: "church-1",
      accountId: "bank-1",
      data: {
        pixTransfer: {
          providerTransferId: "transfer-1",
          status: "DONE",
          amountInCents: 74283,
          externalReference: ctx.currentPayment.externalReference,
          context,
          transactionReceiptUrl: "https://www.asaas.com/receipt/1",
          failureCode: null,
        },
      },
    })
    const [, args, options] = ctx.queue.dispatch.mock.calls[0]!
    expect(args).toMatchObject({
      amount: 742.83,
      churchId: "church-1",
      financialRecordType: "OUTGO",
      source: "AUTO",
      status: "RECONCILED",
      recurringPaymentId: "recurring-1",
      recurringCompetence: "2026-10",
      bankingExternalReference: ctx.currentPayment.externalReference,
      voucher: "receipt-key",
    })
    expect(options).toMatchObject({
      jobId: expect.stringMatching(/^recurring-/),
    })
    expect(ctx.receipt.save).toHaveBeenCalledWith(
      ctx.currentPayment.externalReference,
      "https://www.asaas.com/receipt/1"
    )
  })

  it("uses the persisted amount for a confirmed bill without webhook amount", async () => {
    const ctx = setup("BILL")
    await ctx.service.processBill({
      id: "event-3",
      type: "BANKING_BILL_PAYMENT_UPDATED",
      occurredAt: "2026-10-01T12:00:00Z",
      externalAccountId: "church-1",
      accountId: "bank-1",
      data: {
        billPayment: {
          providerBillId: "bill-1",
          status: "PAID",
          externalReference: ctx.currentPayment.externalReference,
          context,
          paymentDate: "2026-10-01T11:00:00Z",
          transactionReceiptUrl: null,
          failureCode: null,
        },
      },
    })
    expect(ctx.queue.dispatch.mock.calls[0]?.[1]).toMatchObject({
      amount: 742.83,
      financialRecordType: "OUTGO",
    })
    expect(ctx.receipt.save).not.toHaveBeenCalled()
  })

  it("acknowledges a duplicate confirmation already represented in FinancialRecord", async () => {
    const ctx = setup()
    ctx.financialRecords.findByBankingExternalReference.mockResolvedValue({
      getChurchId: () => "church-1",
      getRecurringPaymentId: () => "recurring-1",
      getReference: () => ({
        type: "RECURRING_PAYMENT",
        entityId: "recurring-1",
      }),
    })
    await ctx.service.processPix({
      id: "event-4",
      type: "BANKING_PIX_TRANSFER_UPDATED",
      occurredAt: "2026-10-01T12:00:00Z",
      externalAccountId: "church-1",
      accountId: "bank-1",
      data: {
        pixTransfer: {
          providerTransferId: "transfer-1",
          status: "DONE",
          amountInCents: 74283,
          externalReference: ctx.currentPayment.externalReference,
          context,
          transactionReceiptUrl: null,
          failureCode: null,
        },
      },
    })
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
    expect(ctx.recurringRepository.one).not.toHaveBeenCalled()
  })

  it("rejects events with a mismatched competence or account binding", async () => {
    const ctx = setup()
    await expect(
      ctx.service.processPix({
        id: "event-5",
        type: "BANKING_PIX_TRANSFER_UPDATED",
        occurredAt: "2026-10-01T12:00:00Z",
        externalAccountId: "church-1",
        accountId: "wrong-bank",
        data: {
          pixTransfer: {
            providerTransferId: "transfer-1",
            status: "DONE",
            amountInCents: 74283,
            externalReference: ctx.currentPayment.externalReference,
            context: { ...context, competence: "2026-11" },
            transactionReceiptUrl: null,
            failureCode: null,
          },
        },
      })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH",
    })
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it("recognizes bill refunds without changing the original financial record", async () => {
    const ctx = setup("BILL")
    const record = {
      getChurchId: () => "church-1",
      getRecurringPaymentId: () => "recurring-1",
      getReference: () => ({
        type: "RECURRING_PAYMENT",
        entityId: "recurring-1",
      }),
    }
    ctx.financialRecords.findByBankingExternalReference.mockResolvedValue(
      record
    )
    await ctx.service.processBill({
      id: "event-6",
      type: "BANKING_BILL_PAYMENT_UPDATED",
      occurredAt: "2026-10-02T12:00:00Z",
      externalAccountId: "church-1",
      accountId: "bank-1",
      data: {
        billPayment: {
          providerBillId: "bill-1",
          status: "REFUNDED",
          externalReference: ctx.currentPayment.externalReference,
          context,
          paymentDate: null,
          transactionReceiptUrl: null,
          failureCode: null,
        },
      },
    })
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
    expect(ctx.recurringRepository.closeCurrentPayment).not.toHaveBeenCalled()
  })
})
