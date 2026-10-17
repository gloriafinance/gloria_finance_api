import { ProcessRecurringPaymentBankingUpdate } from "@/Webhook/infrastructure/services/ProcessRecurringPaymentBankingUpdate.service"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence/AvailabilityAccountMongoRepository"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence/FinancialConceptMongoRepository"
import { FinancialConfigurationMongoRepository } from "@/FinanceConfig/infrastructure/presistence/FinancialConfigurationMongoRepository"
import { QueueService } from "@/package/queue/infrastructure/QueueService"

/**
 * The service resolves the accounting imputation with its own repositories and
 * the queue singleton when it builds the record registrar, so the collaborators
 * that are not injectable through the constructor are replaced here.
 */
afterEach(() => {
  jest.restoreAllMocks()
})

function setup() {
  const currentPayment = {
    competence: "2026-10",
    externalReference: "urn:recurringPayment:recurring-1:2026-10",
    amount: 742.83,
    paymentMethod: "PIX" as const,
    bankId: "bank-1",
    availabilityAccountId: "availability-1",
    status: "PROCESSING" as const,
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
    one: jest.fn().mockResolvedValue(undefined),
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

  jest
    .spyOn(AvailabilityAccountMongoRepository, "getInstance")
    .mockReturnValue(availabilityAccounts as never)
  jest
    .spyOn(FinancialConceptMongoRepository, "getInstance")
    .mockReturnValue(conceptRepository as never)
  jest
    .spyOn(FinancialConfigurationMongoRepository, "getInstance")
    .mockReturnValue(financialConfiguration as never)
  jest.spyOn(QueueService, "getInstance").mockReturnValue(queue as never)

  const service = new ProcessRecurringPaymentBankingUpdate(
    recurringRepository as never,
    financialRecords as never,
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
      })
      expect(ctx.queue.dispatch).not.toHaveBeenCalled()
    }
  )

  it.each([
    ["PENDING", "PROCESSING"],
    // church-banking reports the provider's bank-processing state as-is; the
    // domain keeps its own PROCESSING vocabulary.
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

  it("books the amount the boleto charged, not the reserved one", async () => {
    const ctx = setup()

    await ctx.service.processBill(billEvent(ctx, "PAID", 78243))

    // The provider's value is the authority once the debit exists: the record
    // reports what the bank actually paid, never the locally declared amount.
    expect(ctx.queue.dispatch.mock.calls[0]?.[1]).toMatchObject({
      amount: 782.43,
      financialRecordType: "OUTGO",
      status: "RECONCILED",
    })
    expect(ctx.receipt.storeRemoteReceipt).not.toHaveBeenCalled()
  })

  it("acknowledges a duplicate confirmation already represented in FinancialRecord", async () => {
    const ctx = setup()
    ctx.financialRecords.one.mockResolvedValue({
      getChurchId: () => "church-1",
      getRecurringPaymentId: () => "recurring-1",
      getRecurringCompetence: () => "2026-10",
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
    })
  })

  it("does not let a late non-terminal event undo a terminal outcome", async () => {
    const ctx = setup()
    ctx.recurringRepository.saveIfCurrentPaymentMatches.mockResolvedValue(false)
    const settled = {
      ...ctx.currentPayment,
      status: "PAID" as const,
    }
    const settledRecurrence = RecurringPayments.fromPrimitives({
      ...ctx.recurrence.toPrimitives(),
      currentPayment: settled,
    })
    ctx.recurringRepository.one.mockResolvedValue(settledRecurrence)

    await ctx.service.processPix(pixEvent(ctx, "IN_BANK_PROCESSING"))

    // The durable terminal state survives untouched.
    expect(settledRecurrence.getCurrentPayment()).toMatchObject({
      status: "PAID" as const,
    })
  })

  it("rejects an event for another church even when the reference exists", async () => {
    const ctx = setup()

    await expect(
      ctx.service.processPix({
        ...pixEvent(ctx, "DONE"),
        externalAccountId: "church-2",
      })
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH",
    })
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it("rejects an event whose reference matches no operation", async () => {
    const ctx = setup()
    ctx.recurringRepository.one.mockResolvedValue(undefined)

    await expect(
      ctx.service.processPix({
        ...pixEvent(ctx, "DONE"),
        data: {
          pixTransfer: {
            ...pixEvent(ctx, "DONE").data.pixTransfer,
            externalReference: "urn:recurringPayment:other:2026-10",
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

  it("rejects a duplicate confirmation that belongs to another church", async () => {
    const ctx = setup()
    ctx.financialRecords.one.mockResolvedValue({
      getChurchId: () => "church-2",
      getRecurringPaymentId: () => "recurring-1",
      getRecurringCompetence: () => "2026-10",
      getReference: () => ({
        type: "RECURRING_PAYMENT",
        entityId: "recurring-1",
      }),
    })

    await expect(
      ctx.service.processBill(billEvent(ctx, "PAID"))
    ).rejects.toMatchObject({
      name: "RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH",
    })
    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
  })

  it("acknowledges a duplicate bill confirmation without booking it again", async () => {
    const ctx = setup()
    ctx.financialRecords.one.mockResolvedValue({
      getChurchId: () => "church-1",
      getRecurringPaymentId: () => "recurring-1",
      getRecurringCompetence: () => "2026-10",
      getReference: () => ({
        type: "RECURRING_PAYMENT",
        entityId: "recurring-1",
      }),
    })

    await ctx.service.processBill(billEvent(ctx, "PAID"))

    expect(ctx.queue.dispatch).not.toHaveBeenCalled()
    expect(ctx.recurringRepository.one).not.toHaveBeenCalled()
  })

  it("recognizes bill refunds without creating another financial record", async () => {
    const ctx = setup()
    ctx.financialRecords.one.mockResolvedValue({
      getChurchId: () => "church-1",
      getRecurringPaymentId: () => "recurring-1",
      getRecurringCompetence: () => "2026-10",
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
