import { describe, expect, it, jest } from "@jest/globals"

jest.mock("jose", () => ({
  CompactEncrypt: class {},
  importJWK: jest.fn(),
  SignJWT: class {},
}))

import { ChurchBankingClient } from "./ChurchBankingClient"

const IDENTIFICATION_FIELD = "00190500954014481606906809350314337370000000100"

function clientReturning(value: unknown): ChurchBankingClient {
  const client = new ChurchBankingClient()
  ;(client as unknown as { execute: () => Promise<unknown> }).execute = jest.fn(
    async () => value
  )
  return client
}

const input = {
  externalAccountId: "church-1",
  externalReference: "urn:recurringPayment:rp-1:2026-10",
}

describe("ChurchBankingClient bill payment status", () => {
  it("reads the durable status and its provider amount", async () => {
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: input.externalAccountId,
        externalReference: input.externalReference,
        identificationField: IDENTIFICATION_FIELD,
        description: "Aluguel",
        status: "PAID",
        valueInCents: 74283,
        providerBillId: "bill-1",
        paymentDate: "2026-11-16",
        transactionReceiptUrl: "https://asaas.test/receipt/bill-1",
        failureCode: null,
      },
    })

    await expect(client.getBillPaymentStatus(input)).resolves.toEqual({
      externalAccountId: input.externalAccountId,
      externalReference: input.externalReference,
      identificationField: IDENTIFICATION_FIELD,
      description: "Aluguel",
      status: "PAID",
      valueInCents: 74283,
      providerBillId: "bill-1",
      paymentDate: "2026-11-16",
      transactionReceiptUrl: "https://asaas.test/receipt/bill-1",
    })
  })

  it("keeps an open state without inventing a provider bill", async () => {
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: input.externalAccountId,
        externalReference: input.externalReference,
        identificationField: IDENTIFICATION_FIELD,
        description: "Aluguel",
        status: "BANK_PROCESSING",
        valueInCents: 74283,
        providerBillId: "bill-1",
        paymentDate: null,
        transactionReceiptUrl: null,
      },
    })

    await expect(client.getBillPaymentStatus(input)).resolves.toMatchObject({
      status: "BANK_PROCESSING",
      valueInCents: 74283,
    })
  })

  it("refuses a response for another reference", async () => {
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: input.externalAccountId,
        externalReference: "urn:recurringPayment:other:2026-10",
        identificationField: IDENTIFICATION_FIELD,
        description: "Aluguel",
        status: "PAID",
        valueInCents: 74283,
        providerBillId: "bill-1",
        paymentDate: "2026-11-16",
        transactionReceiptUrl: null,
      },
    })

    await expect(client.getBillPaymentStatus(input)).rejects.toMatchObject({
      name: "CHURCH_BANKING_INVALID_RESPONSE",
    })
  })
})
