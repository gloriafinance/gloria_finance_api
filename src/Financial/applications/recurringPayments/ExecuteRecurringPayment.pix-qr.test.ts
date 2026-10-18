import { describe, expect, it, jest } from "@jest/globals"
import { createHash } from "node:crypto"
import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { ExecuteRecurringPayment } from "./ExecuteRecurringPayment"

const QR_PAYLOAD = "000201-original-pix-payload"
const REFERENCE = "urn:recurringPayment:recurring-1:2026-10"

function build(
  options: {
    qrResponses?: unknown[]
    statusResponses?: unknown[]
    qrError?: unknown
    statusError?: unknown
    currentPayment?: Record<string, unknown>
  } = {}
) {
  const recurring = RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Aluguel",
    type: "FIXED",
    amount: 100,
    dayOfMonth: 10,
    status: "ACTIVE",
    ...(options.currentPayment
      ? { currentPayment: options.currentPayment as never }
      : {}),
  })
  const recurringPaymentsRepository = {
    one: jest.fn(async () => recurring),
    saveIfCurrentPaymentMatches: jest.fn(async () => true),
  }
  const financialRecordRepository = {
    findRecurringPayment: jest.fn(async () => undefined),
  }
  const account = {
    getAvailabilityAccountId: () => "availability-1",
    getSource: () => ({ bankId: "bank-1" }),
  }
  const banking = {
    payPixQr: jest.fn(async (..._args: unknown[]) => {
      if (options.qrError) throw options.qrError
      const response = options.qrResponses?.shift()
      return (
        response ?? {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "DONE",
          providerTransactionId: "pix-tx-1",
        }
      )
    }),
    getPixQrStatus: jest.fn(async (..._args: unknown[]) => {
      if (options.statusError) throw options.statusError
      const response = options.statusResponses?.shift()
      return (
        response ?? {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "PENDING",
          providerTransactionId: "pix-tx-1",
        }
      )
    }),
    createPixTransfer: jest.fn(),
    createBillPayment: jest.fn(),
  }
  const recordRegistrar = {
    execute: jest.fn(async (..._args: unknown[]) => undefined),
  }
  const useCase = new ExecuteRecurringPayment(
    recurringPaymentsRepository as never,
    financialRecordRepository as never,
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
      list: jest.fn(async () => [account]),
    } as never,
    { one: jest.fn(async () => ({ isClosed: () => false })) } as never,
    banking as never,
    recordRegistrar as never,
    () => new Date("2026-10-17T12:00:00.000Z")
  )

  return {
    useCase,
    recurring,
    recurringPaymentsRepository,
    financialRecordRepository,
    banking,
    recordRegistrar,
  }
}

const request = {
  competence: "2026-10",
  payment: { type: "PIX_QR" as const, payload: QR_PAYLOAD },
  availabilityAccountId: "availability-1",
}

describe("ExecuteRecurringPayment PIX QR", () => {
  it("books only a confirmed DONE with the provider amount and stable reference", async () => {
    const { useCase, recurring, banking, recordRegistrar } = build()

    const result = await useCase.execute(
      "church-1",
      "recurring-1",
      request,
      "user-1"
    )

    expect(result).toMatchObject({
      status: "PAID",
      providerValueInCents: 15000,
    })
    expect(banking.payPixQr).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      externalReference: REFERENCE,
      payload: QR_PAYLOAD,
      description: "Aluguel",
    })
    expect(recordRegistrar.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 150,
        availabilityAccountId: "availability-1",
        bankingExternalReference: REFERENCE,
      })
    )
    expect(recurring.getCurrentPayment()?.status).toBe("PAID")
    expect(recurring.getCurrentPayment()?.amount).toBe(150)
  })

  it("reconciles PENDING to DONE through the same reserved identity", async () => {
    const { useCase, recurring, banking, recordRegistrar } = build({
      qrResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "PENDING",
          providerTransactionId: "pix-tx-1",
        },
      ],
      statusResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "DONE",
          providerTransactionId: "pix-tx-1",
        },
      ],
    })

    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "PROCESSING" })
    expect(recurring.getCurrentPayment()?.providerPaymentReserved).toBe(true)
    expect(recordRegistrar.execute).not.toHaveBeenCalled()

    await expect(
      useCase.reconcilePixQr("church-1", "recurring-1", "2026-10", "user-1")
    ).resolves.toMatchObject({ status: "PAID", providerValueInCents: 15000 })
    expect(banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(banking.getPixQrStatus).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      externalReference: REFERENCE,
    })
    expect(recordRegistrar.execute).toHaveBeenCalledTimes(1)
    expect(recurring.getCurrentPayment()?.status).toBe("PAID")
  })

  it("records a confirmed 422 as FAILED and does not create a financial record", async () => {
    const { useCase, recurring, banking, recordRegistrar } = build({
      qrError: new ChurchBankingClientError(
        422,
        "ASAAS_PIX_QR_PAYMENT_REJECTED"
      ),
    })

    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({
      status: "FAILED",
      failureCode: "ASAAS_PIX_QR_PAYMENT_REJECTED",
    })
    expect(banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(banking.getPixQrStatus).not.toHaveBeenCalled()
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
    expect(recurring.getCurrentPayment()?.status).toBe("FAILED")
  })

  it("keeps CREATION_UNKNOWN blocked and never asks for a second payment", async () => {
    const { useCase, recurring, banking, recordRegistrar } = build({
      qrResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "CREATION_UNKNOWN",
          errorCode: "ASAAS_PIX_QR_PAYMENT_CREATION_UNKNOWN",
        },
      ],
    })

    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "BLOCKED" })
    await expect(
      useCase.reconcilePixQr("church-1", "recurring-1", "2026-10", "user-1")
    ).resolves.toMatchObject({ status: "BLOCKED" })
    expect(banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
    expect(recurring.getCurrentPayment()?.status).toBe("BLOCKED")
  })

  it("keeps an ambiguous 503 PROCESSING and repairs it through the status read", async () => {
    const { useCase, recurring, banking, recordRegistrar } = build({
      qrError: new ChurchBankingClientError(
        503,
        "ASAAS_PIX_QR_PAYMENT_CREDENTIAL_UNAVAILABLE"
      ),
    })

    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({
      status: "PROCESSING",
      failureCode: "ASAAS_PIX_QR_PAYMENT_CREDENTIAL_UNAVAILABLE",
    })
    expect(recurring.getCurrentPayment()?.providerPaymentReserved).toBeFalsy()

    // The lost creation response is repaired by the read-only status read, and
    // that read never becomes a new payment command.
    await expect(
      useCase.reconcilePixQr("church-1", "recurring-1", "2026-10", "user-1")
    ).resolves.toMatchObject({ status: "PROCESSING" })
    expect(banking.getPixQrStatus).toHaveBeenCalledTimes(1)
    expect(banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
  })

  it("reconciles a lost creation response through the status read", async () => {
    const { useCase, recurring, banking, recordRegistrar } = build({
      qrError: new Error("socket hang up"),
      statusResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "DONE",
          providerTransactionId: "pix-tx-1",
        },
      ],
    })

    // Church Banking created the payment, but the answer never arrived, so no
    // reservation was ever acknowledged.
    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).rejects.toThrow("socket hang up")
    expect(recurring.getCurrentPayment()?.status).toBe("PROCESSING")
    expect(recurring.getCurrentPayment()?.providerPaymentReserved).toBeFalsy()
    expect(banking.payPixQr).toHaveBeenCalledTimes(1)

    await expect(
      useCase.reconcilePixQr("church-1", "recurring-1", "2026-10", "user-1")
    ).resolves.toMatchObject({ status: "PAID", providerValueInCents: 15000 })
    expect(banking.getPixQrStatus).toHaveBeenCalledTimes(1)
    expect(banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(recordRegistrar.execute).toHaveBeenCalledTimes(1)
    expect(recurring.getCurrentPayment()?.status).toBe("PAID")
  })

  it("preserves uncertainty when the status read does not know the reference", async () => {
    const { useCase, recurring, banking, recordRegistrar } = build({
      currentPayment: reservedPayment(false),
      statusError: new ChurchBankingClientError(404, "PAYMENT_NOT_FOUND"),
    })

    await expect(
      useCase.reconcilePixQr("church-1", "recurring-1", "2026-10", "user-1")
    ).resolves.toMatchObject({ status: "PROCESSING" })
    expect(banking.getPixQrStatus).toHaveBeenCalledTimes(1)
    expect(banking.payPixQr).not.toHaveBeenCalled()
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
    expect(recurring.getCurrentPayment()?.status).toBe("PROCESSING")
  })

  it("keeps a 409 identity conflict PROCESSING instead of a confirmed failure", async () => {
    const { useCase, recurring, banking } = build({
      qrError: new ChurchBankingClientError(
        409,
        "PIX_QR_PAYMENT_IDENTITY_CONFLICT"
      ),
    })

    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "PROCESSING" })
    expect(recurring.getCurrentPayment()?.status).toBe("PROCESSING")
    expect(banking.payPixQr).toHaveBeenCalledTimes(1)
  })

  it("maps a provider REFUSED to FAILED without booking a record", async () => {
    const { useCase, recurring, recordRegistrar } = build({
      qrResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "REFUSED",
          providerTransactionId: "pix-tx-1",
        },
      ],
    })

    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "FAILED" })
    expect(recurring.getCurrentPayment()?.status).toBe("FAILED")
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
  })

  it("reconciles STATUS_UNRECOGNIZED to DONE through the reserved identity", async () => {
    const { useCase, recurring, banking } = build({
      qrResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "STATUS_UNRECOGNIZED",
          providerTransactionId: "pix-tx-1",
        },
      ],
      statusResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "DONE",
          providerTransactionId: "pix-tx-1",
        },
      ],
    })

    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "PROCESSING" })
    await expect(
      useCase.reconcilePixQr("church-1", "recurring-1", "2026-10", "user-1")
    ).resolves.toMatchObject({ status: "PAID" })
    expect(banking.getPixQrStatus).toHaveBeenCalledTimes(1)
    expect(recurring.getCurrentPayment()?.status).toBe("PAID")
  })

  it("never re-sends /qr/pay for an in-flight PIX QR, only reads its status", async () => {
    const { useCase, recurring, banking, recordRegistrar } = build({
      currentPayment: reservedPayment(true),
      statusResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15000,
          status: "REFUSED",
          providerTransactionId: "pix-tx-1",
        },
      ],
    })

    // A repeated command while this service still reports PROCESSING must not
    // reach `/qr/pay`: that endpoint would legitimately retry the refusal and
    // move money again without the operator ever seeing it.
    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "FAILED" })
    expect(banking.getPixQrStatus).toHaveBeenCalledTimes(1)
    expect(banking.payPixQr).not.toHaveBeenCalled()
    expect(recurring.getCurrentPayment()?.status).toBe("FAILED")
    expect(recordRegistrar.execute).not.toHaveBeenCalled()
  })

  it("uses /qr/pay again only for a new attempt after FAILED was persisted", async () => {
    const { useCase, recurring, banking } = build({
      currentPayment: { ...reservedPayment(true), status: "FAILED" },
    })

    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "PAID" })
    expect(banking.getPixQrStatus).not.toHaveBeenCalled()
    expect(banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(recurring.getCurrentPayment()?.status).toBe("PAID")
  })
})

function reservedPayment(providerPaymentReserved: boolean) {
  return {
    competence: "2026-10",
    externalReference: REFERENCE,
    amount: 100,
    paymentMethod: "PIX_QR",
    executionDestination: `PIX_QR:${createHash("sha256")
      .update(QR_PAYLOAD)
      .digest("hex")}`,
    bankId: "bank-1",
    availabilityAccountId: "availability-1",
    status: "PROCESSING",
    providerPaymentReserved,
    updatedAt: new Date("2026-10-17T12:00:00.000Z"),
  }
}
