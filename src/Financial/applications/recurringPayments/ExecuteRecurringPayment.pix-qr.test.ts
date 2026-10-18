import { describe, expect, it, jest } from "@jest/globals"
import { createHash } from "node:crypto"
import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"
import type {
  IChurchBankingClient,
  PayPixQrResponse,
} from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import type { CurrentRecurringPayment } from "@/Financial/domain/RecurringPayments"
import { RecurringPixQrExecution } from "./RecurringPixQrExecution"
import { RegisterRecurringPaymentFinancialRecord } from "./RegisterRecurringPaymentFinancialRecord"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { ExecuteRecurringPayment } from "./ExecuteRecurringPayment"

const QR_PAYLOAD = "000201-original-pix-payload"
const REFERENCE = "urn:recurringPayment:recurring-1:2026-10"

function build(
  options: {
    type?: "FIXED" | "VARIABLE"
    closedMonth?: boolean
    accountAvailable?: boolean
    decodedAmountInCents?: number
    decodeError?: unknown
    qrResponses?: PayPixQrResponse[]
    statusResponses?: PayPixQrResponse[]
    qrError?: unknown
    statusError?: unknown
    currentPayment?: CurrentRecurringPayment
  } = {}
) {
  const recurring = RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Aluguel",
    type: options.type ?? "FIXED",
    ...(options.type === "VARIABLE" ? {} : { amount: 100 }),
    dayOfMonth: 10,
    status: "ACTIVE",
    ...(options.currentPayment
      ? { currentPayment: options.currentPayment }
      : {}),
  })
  const callOrder: string[] = []
  const reservations: CurrentRecurringPayment[] = []
  const recurringPaymentsRepository = {
    one: jest.fn(async () => recurring),
    saveIfCurrentPaymentMatches: jest.fn(
      async (
        entity: RecurringPayments,
        _expected: CurrentRecurringPayment | undefined
      ) => {
        callOrder.push("save")
        reservations.push(structuredClone(entity.getCurrentPayment()!))
        return true
      }
    ),
  }
  const financialRecordRepository = {
    findRecurringPayment: jest.fn(async () => undefined),
  }
  const account = {
    getAvailabilityAccountId: () => "availability-1",
    getSource: () => ({ bankId: "bank-1" }),
  }
  const banking = {
    decodePixQr: jest.fn<IChurchBankingClient["decodePixQr"]>(async () => {
      callOrder.push("decode")
      if (options.decodeError) throw options.decodeError
      return { amountInCents: options.decodedAmountInCents ?? 12500 }
    }),
    payPixQr: jest.fn<IChurchBankingClient["payPixQr"]>(async () => {
      callOrder.push("pay")
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
    getPixQrStatus: jest.fn<IChurchBankingClient["getPixQrStatus"]>(
      async () => {
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
      }
    ),
    createPixTransfer: jest.fn<IChurchBankingClient["createPixTransfer"]>(),
    createBillPayment: jest.fn<IChurchBankingClient["createBillPayment"]>(),
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
      list: jest.fn(async () =>
        options.accountAvailable === false ? [] : [account]
      ),
    } as never,
    {
      one: jest.fn(async () => ({
        isClosed: () => options.closedMonth === true,
      })),
    } as never,
    {
      createPixTransfer: banking.createPixTransfer,
      createBillPayment: banking.createBillPayment,
      decodePixQr: banking.decodePixQr,
    },
    new RecurringPixQrExecution(
      recurringPaymentsRepository as never,
      { payPixQr: banking.payPixQr, getPixQrStatus: banking.getPixQrStatus },
      recordRegistrar as never,
      () => new Date("2026-10-17T12:00:00.000Z")
    ),
    () => new Date("2026-10-17T12:00:00.000Z")
  )

  return {
    useCase,
    recurring,
    recurringPaymentsRepository,
    financialRecordRepository,
    banking,
    recordRegistrar,
    callOrder,
    reservations,
  }
}

const request = {
  competence: "2026-10",
  payment: { type: "PIX_QR" as const, payload: QR_PAYLOAD },
  availabilityAccountId: "availability-1",
}

describe("ExecuteRecurringPayment PIX QR", () => {
  it("books only a confirmed DONE with the provider amount and stable reference", async () => {
    const { useCase, recurring, banking, recordRegistrar, reservations } =
      build()

    const result = await useCase.execute(
      "church-1",
      "recurring-1",
      request,
      "user-1"
    )

    expect(banking.decodePixQr).not.toHaveBeenCalled()
    expect(reservations[0]).toMatchObject({ amount: 100, status: "PROCESSING" })
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

  it("reconciles variable PENDING to DONE using the status amount", async () => {
    const { useCase, recurring, banking, recordRegistrar } = build({
      type: "VARIABLE",
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
          amountInCents: 15789,
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
    ).resolves.toMatchObject({ status: "PAID", providerValueInCents: 15789 })
    expect(banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(banking.getPixQrStatus).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      externalReference: REFERENCE,
    })
    expect(recordRegistrar.execute).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 157.89 })
    )
    expect(recurring.getCurrentPayment()?.amount).toBe(157.89)
    expect(banking.decodePixQr).toHaveBeenCalledTimes(1)
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
    await expect(
      useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "BLOCKED" })
    expect(banking.getPixQrStatus).not.toHaveBeenCalled()
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
  it("decodes a variable QR before reserving and uses the pay response amount", async () => {
    const ctx = build({ type: "VARIABLE", decodedAmountInCents: 12345 })

    await expect(
      ctx.useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "PAID", providerValueInCents: 15000 })

    expect(ctx.banking.decodePixQr).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      payload: QR_PAYLOAD,
    })
    expect(ctx.callOrder.slice(0, 3)).toEqual(["decode", "save", "pay"])
    expect(ctx.reservations[0]).toMatchObject({
      amount: 123.45,
      status: "PROCESSING",
    })
    expect(ctx.recurring.getCurrentPayment()?.amount).toBe(150)
    expect(ctx.recordRegistrar.execute).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 150 })
    )
  })

  it.each([
    ["the financial month is closed", { closedMonth: true }],
    ["the account is unavailable", { accountAvailable: false }],
  ] as const)(
    "does not decode a variable QR when %s",
    async (_reason, options) => {
      const ctx = build({ type: "VARIABLE", ...options })
      await expect(
        ctx.useCase.execute("church-1", "recurring-1", request, "user-1")
      ).rejects.toBeDefined()
      expect(ctx.banking.decodePixQr).not.toHaveBeenCalled()
      expect(
        ctx.recurringPaymentsRepository.saveIfCurrentPaymentMatches
      ).not.toHaveBeenCalled()
      expect(ctx.banking.payPixQr).not.toHaveBeenCalled()
      expect(ctx.recurring.getCurrentPayment()).toBeUndefined()
    }
  )

  it("does not reserve or send money if variable QR decoding fails", async () => {
    const error = new ChurchBankingClientError(422, "PIX_QR_INVALID")
    const ctx = build({ type: "VARIABLE", decodeError: error })

    await expect(
      ctx.useCase.execute("church-1", "recurring-1", request, "user-1")
    ).rejects.toBe(error)
    expect(
      ctx.recurringPaymentsRepository.saveIfCurrentPaymentMatches
    ).not.toHaveBeenCalled()
    expect(ctx.recurring.getCurrentPayment()).toBeUndefined()
    expect(ctx.banking.payPixQr).not.toHaveBeenCalled()
    expect(ctx.recordRegistrar.execute).not.toHaveBeenCalled()
  })

  it.each([0, -1, 12.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid decoded cents %s before reservation",
    async (decodedAmountInCents) => {
      const ctx = build({ type: "VARIABLE", decodedAmountInCents })
      await expect(
        ctx.useCase.execute("church-1", "recurring-1", request, "user-1")
      ).rejects.toMatchObject({ code: "CHURCH_BANKING_INVALID_RESPONSE" })
      expect(
        ctx.recurringPaymentsRepository.saveIfCurrentPaymentMatches
      ).not.toHaveBeenCalled()
      expect(ctx.banking.payPixQr).not.toHaveBeenCalled()
    }
  )

  it.each(["FIXED", "VARIABLE"] as const)(
    "forbids a client QR amount for %s",
    async (type) => {
      const ctx = build({ type })
      await expect(
        ctx.useCase.execute(
          "church-1",
          "recurring-1",
          { ...request, amount: 100 },
          "user-1"
        )
      ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_AMOUNT_FORBIDDEN" })
      expect(ctx.banking.decodePixQr).not.toHaveBeenCalled()
      expect(
        ctx.recurringPaymentsRepository.saveIfCurrentPaymentMatches
      ).not.toHaveBeenCalled()
      expect(ctx.banking.payPixQr).not.toHaveBeenCalled()
    }
  )

  it.each(["PAID", "BLOCKED"] as const)(
    "returns %s without another payment or status call",
    async (status) => {
      const ctx = build({
        currentPayment: { ...reservedPayment(true), status },
      })
      await expect(
        ctx.useCase.execute("church-1", "recurring-1", request, "user-1")
      ).resolves.toMatchObject({ status })
      expect(ctx.banking.payPixQr).not.toHaveBeenCalled()
      expect(ctx.banking.getPixQrStatus).not.toHaveBeenCalled()
      expect(ctx.banking.decodePixQr).not.toHaveBeenCalled()
      expect(
        ctx.recurringPaymentsRepository.saveIfCurrentPaymentMatches
      ).not.toHaveBeenCalled()
    }
  )

  it("preserves the QR fingerprint when an in-flight request changes payload", async () => {
    const ctx = build({ currentPayment: reservedPayment(true) })
    await expect(
      ctx.useCase.execute(
        "church-1",
        "recurring-1",
        {
          ...request,
          payment: { type: "PIX_QR", payload: "another-qr" },
        },
        "user-1"
      )
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_IN_PROGRESS" })
    expect(ctx.banking.payPixQr).not.toHaveBeenCalled()
    expect(ctx.banking.getPixQrStatus).not.toHaveBeenCalled()
    expect(ctx.recurring.getCurrentPayment()?.executionDestination).toBe(
      reservedPayment(true).executionDestination
    )
  })

  it("recovers a creation timeout through status without sending another payment", async () => {
    const ctx = build({
      type: "VARIABLE",
      qrError: new ChurchBankingClientError(504, "CHURCH_BANKING_TIMEOUT"),
      statusResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 15555,
          status: "DONE",
          providerTransactionId: "pix-1",
        },
      ],
    })
    await expect(
      ctx.useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "PROCESSING" })
    await expect(
      ctx.useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "PAID", providerValueInCents: 15555 })
    expect(ctx.banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(ctx.banking.decodePixQr).toHaveBeenCalledTimes(1)
    expect(ctx.recordRegistrar.execute).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 155.55 })
    )
  })

  it("starts a new reserved attempt only after a refusal was observed", async () => {
    const ctx = build({
      type: "VARIABLE",
      currentPayment: reservedPayment(true),
      statusResponses: [
        {
          externalAccountId: "church-1",
          externalReference: REFERENCE,
          description: "Aluguel",
          amountInCents: 12500,
          status: "REFUSED",
          providerTransactionId: "pix-1",
        },
      ],
    })
    await expect(
      ctx.useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "FAILED" })
    expect(ctx.banking.payPixQr).not.toHaveBeenCalled()
    expect(ctx.banking.decodePixQr).not.toHaveBeenCalled()
    await expect(
      ctx.useCase.execute("church-1", "recurring-1", request, "user-1")
    ).resolves.toMatchObject({ status: "PAID" })
    expect(ctx.callOrder.slice(1, 4)).toEqual(["decode", "save", "pay"])
    expect(ctx.banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(ctx.banking.payPixQr).toHaveBeenCalledWith(
      expect.objectContaining({ externalReference: REFERENCE })
    )
  })

  it("allows only one QR debit when two requests race for the CAS reservation", async () => {
    const ctx = build({ type: "VARIABLE" })
    let stored = ctx.recurring.toPrimitives()
    let reservationAttempts = 0
    let releaseBoth: () => void = () => {}
    const bothPrepared = new Promise<void>((resolve) => {
      releaseBoth = resolve
    })
    ctx.recurringPaymentsRepository.one.mockImplementation(async () =>
      RecurringPayments.fromPrimitives(structuredClone(stored))
    )
    ctx.recurringPaymentsRepository.saveIfCurrentPaymentMatches.mockImplementation(
      async (entity, expected) => {
        if (!expected) {
          reservationAttempts++
          if (reservationAttempts === 2) releaseBoth()
          await bothPrepared
        }
        if (JSON.stringify(stored.currentPayment) !== JSON.stringify(expected))
          return false
        stored = structuredClone(entity.toPrimitives())
        return true
      }
    )

    const results = await Promise.all([
      ctx.useCase.execute("church-1", "recurring-1", request, "user-1"),
      ctx.useCase.execute("church-1", "recurring-1", request, "user-1"),
    ])
    expect(reservationAttempts).toBe(2)
    expect(results.some((result) => result.status === "PAID")).toBe(true)
    expect(ctx.banking.payPixQr).toHaveBeenCalledTimes(1)
    expect(stored.currentPayment?.status).toBe("PAID")
  })

  it("deduplicates concurrent DONE accounting through the existing registrar", async () => {
    const ctx = build({ currentPayment: reservedPayment(true) })
    const jobs = new Map<string, unknown>()
    const dispatch = jest.fn(
      (_name: unknown, payload: unknown, options: { jobId: string }) => {
        jobs.set(options.jobId, payload)
      }
    )
    const registrar = new RegisterRecurringPaymentFinancialRecord(
      {
        findRecurringPayment: jest.fn(async () => undefined),
        countRecurringPaymentRecords: jest.fn(async () => 0),
      } as never,
      { one: jest.fn(async () => ({})) } as never,
      { one: jest.fn(async () => ({})) } as never,
      { findCostCenterByCostCenterId: jest.fn(async () => ({})) } as never,
      { dispatch } as never
    )
    const execution = new RecurringPixQrExecution(
      ctx.recurringPaymentsRepository as never,
      {
        payPixQr: ctx.banking.payPixQr,
        getPixQrStatus: jest.fn<IChurchBankingClient["getPixQrStatus"]>(
          async () => ({
            externalAccountId: "church-1",
            externalReference: REFERENCE,
            description: "Aluguel",
            status: "DONE",
            amountInCents: 15789,
            providerTransactionId: "pix-1",
          })
        ),
      },
      registrar
    )
    const payment = ctx.recurring.getCurrentPayment()!
    await Promise.all([
      execution.reconcile(ctx.recurring, payment, "user-1"),
      execution.reconcile(ctx.recurring, payment, "user-1"),
    ])
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(jobs.size).toBe(1)
    expect([...jobs.values()][0]).toMatchObject({
      amount: 157.89,
      bankingExternalReference: REFERENCE,
    })
    expect(ctx.banking.payPixQr).not.toHaveBeenCalled()
    await execution.reconcile(
      ctx.recurring,
      ctx.recurring.getCurrentPayment()!,
      "user-1"
    )
    expect(dispatch).toHaveBeenCalledTimes(2)
  })
})

function reservedPayment(
  providerPaymentReserved: boolean
): CurrentRecurringPayment {
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
