import { describe, expect, it, jest } from "@jest/globals"
import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"
import type {
  ChurchBankingBillPaymentResponse,
  IChurchBankingClient,
} from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import type { CurrentRecurringPayment } from "@/Financial/domain/RecurringPayments"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { ExecuteRecurringPayment } from "./ExecuteRecurringPayment"

const REFERENCE = "urn:recurringPayment:recurring-1:2026-10"
const IDENTIFICATION_FIELD = "00190500954014481606906809350314337370000000100"
const NOW = () => new Date("2026-11-16T12:00:00.000Z")

function processingPayment(
  overrides: Partial<CurrentRecurringPayment> = {}
): CurrentRecurringPayment {
  return {
    competence: "2026-10",
    externalReference: REFERENCE,
    amount: 742.83,
    paymentMethod: "BILL",
    executionDestination: IDENTIFICATION_FIELD,
    bankId: "bank-1",
    availabilityAccountId: "availability-1",
    status: "PROCESSING",
    identificationField: IDENTIFICATION_FIELD,
    updatedAt: NOW(),
    ...overrides,
  }
}

function billPayment(
  overrides: Record<string, unknown> = {}
): ChurchBankingBillPaymentResponse {
  return {
    externalAccountId: "church-1",
    externalReference: REFERENCE,
    identificationField: IDENTIFICATION_FIELD,
    description: "Aluguel",
    status: "PAID",
    valueInCents: 74283,
    providerBillId: "bill-1",
    paymentDate: "2026-11-16",
    transactionReceiptUrl: "https://asaas.test/receipt/bill-1",
    ...overrides,
  } as ChurchBankingBillPaymentResponse
}

function build(
  options: {
    currentPayment?: CurrentRecurringPayment
    statusResponses?: ChurchBankingBillPaymentResponse[]
    statusError?: unknown
  } = {}
) {
  const recurring = RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Aluguel",
    type: "FIXED",
    amount: 742.83,
    dayOfMonth: 10,
    status: "ACTIVE",
    ...(options.currentPayment
      ? { currentPayment: options.currentPayment }
      : {}),
  })
  const saved: CurrentRecurringPayment[] = []
  const recurringPaymentsRepository = {
    one: jest.fn(async () => recurring),
    saveIfCurrentPaymentMatches: jest.fn(
      async (entity: RecurringPayments, _expected: CurrentRecurringPayment) => {
        saved.push(structuredClone(entity.getCurrentPayment()!))
        return true
      }
    ),
  }
  const getBillPaymentStatus = jest.fn<
    IChurchBankingClient["getBillPaymentStatus"]
  >(async () => {
    if (options.statusError) throw options.statusError
    return options.statusResponses?.shift() ?? billPayment()
  })
  const banking = {
    getBillPaymentStatus,
    createPixTransfer: jest.fn<IChurchBankingClient["createPixTransfer"]>(),
    createBillPayment: jest.fn<IChurchBankingClient["createBillPayment"]>(),
    decodePixQr: jest.fn<IChurchBankingClient["decodePixQr"]>(),
  }
  const useCase = new ExecuteRecurringPayment(
    recurringPaymentsRepository as never,
    { findRecurringPayment: jest.fn(async () => undefined) } as never,
    {
      all: jest.fn(async () => [
        {
          getBankId: () => "bank-1",
          isActive: () => true,
          isConnectedTo: () => true,
        },
      ]),
    } as never,
    {
      many: jest.fn(async () => [
        {
          getAvailabilityAccountId: () => "availability-1",
          getSource: () => ({ bankId: "bank-1" }),
        },
      ]),
    } as never,
    { one: jest.fn(async () => ({ isClosed: () => false })) } as never,
    banking as never,
    { submit: jest.fn(), reconcile: jest.fn() } as never,
    NOW
  )

  return { useCase, recurring, banking, saved }
}

describe("ExecuteRecurringPayment BILL reconciliation", () => {
  it("advances a stuck execution with the status church-banking reports", async () => {
    const { useCase, saved } = build({ currentPayment: processingPayment() })

    const result = await useCase.reconcileBillPayment(
      "church-1",
      "recurring-1",
      "2026-10"
    )

    expect(result).toMatchObject({
      status: "PAID",
      competence: "2026-10",
      providerValueInCents: 74283,
    })
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      status: "PAID",
      // The billed amount is authoritative over the reserved one.
      amount: 742.83,
      paymentDate: "2026-11-16",
      transactionReceiptUrl: "https://asaas.test/receipt/bill-1",
    })
  })

  it("keeps the execution in flight when the status read fails", async () => {
    const { useCase, saved } = build({
      currentPayment: processingPayment(),
      statusError: new ChurchBankingClientError(503, "CHURCH_BANKING_DOWN"),
    })

    const result = await useCase.reconcileBillPayment(
      "church-1",
      "recurring-1",
      "2026-10"
    )

    // An unsuccessful read cannot prove a refusal, so nothing is persisted.
    expect(result).toMatchObject({ status: "PROCESSING" })
    expect(saved).toHaveLength(0)
  })

  it("does not read a status for a payment that was not made by boleto", async () => {
    const { useCase, banking } = build({
      currentPayment: processingPayment({
        paymentMethod: "PIX",
        identificationField: undefined,
      }),
    })

    await expect(
      useCase.reconcileBillPayment("church-1", "recurring-1", "2026-10")
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_IN_PROGRESS" })
    expect(banking.getBillPaymentStatus).not.toHaveBeenCalled()
  })

  it("reconciles instead of echoing the stored state when the command is repeated", async () => {
    const { useCase, banking } = build({
      currentPayment: processingPayment(),
    })

    const result = await useCase.execute(
      "church-1",
      "recurring-1",
      {
        competence: "2026-10",
        payment: { type: "BILL", identificationField: IDENTIFICATION_FIELD },
        availabilityAccountId: "availability-1",
      },
      "user-1"
    )

    expect(banking.getBillPaymentStatus).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      externalReference: REFERENCE,
    })
    expect(result).toMatchObject({ status: "PAID" })
  })

  it("refuses to reconcile a different boleto while one is in flight", async () => {
    const { useCase, banking } = build({
      currentPayment: processingPayment(),
    })

    await expect(
      useCase.execute(
        "church-1",
        "recurring-1",
        {
          competence: "2026-10",
          payment: {
            type: "BILL",
            identificationField:
              "00190500954014481606906809350314337370000000999",
          },
          availabilityAccountId: "availability-1",
        },
        "user-1"
      )
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_IN_PROGRESS" })
    expect(banking.getBillPaymentStatus).not.toHaveBeenCalled()
  })
})
