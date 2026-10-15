import { ProcessRecurringPaymentBankingUpdate } from "@/Webhook/infrastructure/services/ProcessRecurringPaymentBankingUpdate.service"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"

function setup() {
  const currentPayment = {
    competence: "2026-10",
    attempt: 1,
    externalReference: "urn:recurringPayment:recurring-1:2026-10:1",
    amount: 742.83,
    paymentMethod: "PIX" as const,
    bankId: "bank-1",
    availabilityAccountId: "availability-1",
    status: "PROCESSING" as const,
    providerStatus: "PENDING",
    updatedAt: new Date("2026-10-01T10:01:00Z"),
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
    currentPayment,
  })
  const recurringRepository = {
    one: jest.fn().mockResolvedValue(recurrence),
    saveIfCurrentPaymentMatches: jest.fn().mockResolvedValue(true),
  }
  const financialRecords = {
    findByBankingExternalReference: jest.fn().mockResolvedValue(undefined),
    countRecurringPaymentRecords: jest.fn().mockResolvedValue(0),
    findRecurringPayment: jest.fn().mockResolvedValue(undefined),
  }
  const concept = {
    getChurchId: () => "church-1",
    getFinancialConceptId: () => "concept-1",
  }
  const conceptRepository = { one: jest.fn().mockResolvedValue(concept) }
  const costCenter = {
    getCostCenterId: () => "cost-center-1",
    getCostCenterName: () => "Templo",
  }
  const financialConfiguration = {
    findCostCenterByCostCenterId: jest.fn().mockResolvedValue(costCenter),
  }
  const account = {
    getAvailabilityAccountId: () => "availability-1",
    getAccountName: () => "Itaú",
    getType: () => "BANK",
    getSymbol: () => "R$",
  }
  const availabilityAccounts = { one: jest.fn().mockResolvedValue(account) }
  const queue = { dispatch: jest.fn() }
  const receipt = {
    storeRemoteReceipt: jest.fn().mockResolvedValue("receipt-key"),
  }
  const service = new ProcessRecurringPaymentBankingUpdate(
    recurringRepository as never,
    financialRecords as never,
    conceptRepository as never,
    availabilityAccounts as never,
    financialConfiguration as never,
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
    financialConfiguration,
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

function pixEvent(ctx: ReturnType<typeof setup>, status: string) {
  return {
    id: `event-${status}`,
    type: "BANKING_PIX_TRANSFER_UPDATED" as const,
    occurredAt: "2026-10-01T12:00:00Z",
    externalAccountId: "church-1",
    accountId: "bank-1",
    data: {
      pixTransfer: {
        providerTransferId: "transfer-1",
        status,
        amountInCents: 74283,
        externalReference: ctx.currentPayment.externalReference,
        context,
        transactionReceiptUrl: null,
        failureCode: null,
      },
    },
  }
}

function billEvent(
  ctx: ReturnType<typeof setup>,
  status: string,
  valueInCents = 74283
) {
  return {
    id: `event-${status}`,
    type: "BANKING_BILL_PAYMENT_UPDATED" as const,
    occurredAt: "2026-10-01T12:00:00Z",
    externalAccountId: "church-1",
    accountId: "bank-1",
    data: {
      billPayment: {
        providerBillId: "bill-1",
        status,
        valueInCents,
        externalReference: ctx.currentPayment.externalReference,
        context,
        paymentDate: null,
        transactionReceiptUrl: null,
        failureCode: null,
      },
    },
  }
}

describe("ProcessRecurringPaymentBankingUpdate", () => {
  it.each([
    ["IN_BANK_PROCESSING", "PROCESSING"],
    ["BLOCKED", "BLOCKED"],
    ["FAILED", "FAILED"],
    ["CANCELLED", "FAILED"],
  ] as const)(
    "maps PIX provider status %s to %s without creating a record",
    async (providerStatus, expectedStatus) => {
      const ctx = setup()
      await ctx.service.processPix(pixEvent(ctx, providerStatus))

      expect(ctx.recurrence.getCurrentPayment()).toMatchObject({
        status: expectedStatus,
        providerStatus,
      })
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
      const ctx = setup()
      await ctx.service.processBill(billEvent(ctx, providerStatus))

      expect(ctx.recurrence.getCurrentPayment()).toMatchObject({
        status: expectedStatus,
        providerStatus,
      })
      expect(ctx.queue.dispatch).not.toHaveBeenCalled()
    }
  )

  it("creates one reconciled OUTGO record with cost center for a confirmed PIX transfer", async () => {
    const ctx = setup()
    await ctx.service.processPix({
      ...pixEvent(ctx, "DONE"),
      data: {
        pixTransfer: {
          ...pixEvent(ctx, "DONE").data.pixTransfer,
          transactionReceiptUrl: "https://www.asaas.com/receipt/1",
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
      createdBy: "system",
      recurringPaymentId: "recurring-1",
      recurringCompetence: "2026-10",
      bankingExternalReference: ctx.currentPayment.externalReference,
      voucher: "receipt-key",
    })
    // The cost center and concept are real domain entities resolved from the
    // recurrence, not the caller's payload.
    expect(args.costCenter.getCostCenterId()).toBe("cost-center-1")
    expect(args.financialConcept.getFinancialConceptId()).toBe("concept-1")
    expect(options).toMatchObject({
      jobId: expect.stringMatching(/^recurring-/),
    })
    expect(ctx.receipt.storeRemoteReceipt).toHaveBeenCalledWith(
      ctx.currentPayment.externalReference,
      "https://www.asaas.com/receipt/1"
    )
  })

  it("uses the persisted amount for a confirmed bill without webhook amount", async () => {
    const ctx = setup()
    await ctx.service.processBill({
      ...billEvent(ctx, "PAID"),
      data: {
        billPayment: {
          ...billEvent(ctx, "PAID").data.billPayment,
          paymentDate: "2026-10-01T11:00:00Z",
        },
      },
    })
    expect(ctx.queue.dispatch.mock.calls[0]?.[1]).toMatchObject({
      amount: 742.83,
      financialRecordType: "OUTGO",
      status: "RECONCILED",
    })
    expect(ctx.receipt.storeRemoteReceipt).not.toHaveBeenCalled()
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
    await ctx.service.processPix(pixEvent(ctx, "DONE"))

    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
    expect(ctx.recurringRepository.one).not.toHaveBeenCalled()
  })

  it("re-applies a status that lost the CAS race instead of dropping it", async () => {
    const ctx = setup()
    // The first write loses; the reload must still land the terminal outcome.
    ctx.recurringRepository.saveIfCurrentPaymentMatches
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    await ctx.service.processPix(pixEvent(ctx, "FAILED"))

    expect(
      ctx.recurringRepository.saveIfCurrentPaymentMatches
    ).toHaveBeenCalledTimes(2)
    expect(ctx.recurrence.getCurrentPayment()).toMatchObject({
      status: "FAILED",
      providerStatus: "FAILED",
    })
  })

  it("does not let a late non-terminal event undo a terminal outcome", async () => {
    const ctx = setup()
    ctx.recurringRepository.saveIfCurrentPaymentMatches.mockResolvedValue(false)
    const settled = {
      ...ctx.currentPayment,
      status: "PROCESSING" as const,
      providerStatus: "DONE",
    }
    const settledRecurrence = RecurringPayments.fromPrimitives({
      ...ctx.recurrence.toPrimitives(),
      currentPayment: settled,
    })
    ctx.recurringRepository.one.mockResolvedValue(settledRecurrence)

    await ctx.service.processPix(pixEvent(ctx, "IN_BANK_PROCESSING"))

    // The durable terminal state survives untouched.
    expect(settledRecurrence.getCurrentPayment()).toMatchObject({
      providerStatus: "DONE",
    })
  })

  it("rejects events with a mismatched competence or account binding", async () => {
    const ctx = setup()
    await expect(
      ctx.service.processPix({
        ...pixEvent(ctx, "DONE"),
        accountId: "wrong-bank",
        data: {
          pixTransfer: {
            ...pixEvent(ctx, "DONE").data.pixTransfer,
            context: { ...context, competence: "2026-11" },
          },
        },
      })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH",
    })
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it("rejects an event whose amount does not match the reserved operation", async () => {
    const ctx = setup()
    await expect(
      ctx.service.processPix({
        ...pixEvent(ctx, "DONE"),
        data: {
          pixTransfer: {
            ...pixEvent(ctx, "DONE").data.pixTransfer,
            amountInCents: 99999,
          },
        },
      })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH",
    })
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it("rejects a paid bill whose amount differs from the recorded one", async () => {
    const ctx = setup()
    await expect(
      ctx.service.processBill(billEvent(ctx, "PAID", 78243))
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BILL_AMOUNT_MISMATCH",
    })
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it("recognizes bill refunds without creating another financial record", async () => {
    const ctx = setup()
    ctx.financialRecords.findByBankingExternalReference.mockResolvedValue({
      getChurchId: () => "church-1",
      getRecurringPaymentId: () => "recurring-1",
      getReference: () => ({
        type: "RECURRING_PAYMENT",
        entityId: "recurring-1",
      }),
    })
    await ctx.service.processBill(billEvent(ctx, "REFUNDED"))

    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
    expect(ctx.recurringRepository.one).not.toHaveBeenCalled()
  })
})
