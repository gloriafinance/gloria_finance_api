import { describe, expect, it, jest } from "@jest/globals"

jest.mock("jose", () => ({
  CompactEncrypt: class {},
  importJWK: jest.fn(),
  SignJWT: class {},
}))

import { ChurchBankingClient } from "./ChurchBankingClient"

function clientReturning(value: unknown): ChurchBankingClient {
  const client = new ChurchBankingClient()
  ;(client as unknown as { execute: () => Promise<unknown> }).execute = jest.fn(
    async () => value
  )
  return client
}

describe("ChurchBankingClient PIX QR responses", () => {
  it("extracts and validates the decode data envelope", async () => {
    const client = clientReturning({
      code: "OK",
      data: { amountInCents: 15000 },
    })

    await expect(
      client.decodePixQr({ externalAccountId: "church-1", payload: "pix" })
    ).resolves.toEqual({ amountInCents: 15000 })
  })

  it("extracts the payment response and preserves the provider transaction", async () => {
    const input = {
      externalAccountId: "church-1",
      externalReference: "urn:recurringPayment:rp-1:2026-10",
      payload: "pix-original",
      description: "Aluguel",
    }
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: input.externalAccountId,
        externalReference: input.externalReference,
        description: input.description,
        amountInCents: 15000,
        status: "DONE",
        providerTransactionId: "pix-tx-1",
      },
    })

    await expect(client.payPixQr(input)).resolves.toEqual({
      externalAccountId: input.externalAccountId,
      externalReference: input.externalReference,
      description: input.description,
      amountInCents: 15000,
      status: "DONE",
      providerTransactionId: "pix-tx-1",
    })
  })

  it("reads the durable QR status by account and external reference", async () => {
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: "church-1",
        externalReference: "urn:recurringPayment:rp-1:2026-10",
        description: "Aluguel",
        amountInCents: 15000,
        status: "DONE",
        providerTransactionId: "pix-tx-1",
      },
    })

    await expect(
      client.getPixQrStatus({
        externalAccountId: "church-1",
        externalReference: "urn:recurringPayment:rp-1:2026-10",
      })
    ).resolves.toMatchObject({ status: "DONE", amountInCents: 15000 })
  })

  it("rejects malformed provider data instead of returning undefined fields", async () => {
    const client = clientReturning({
      code: "OK",
      data: { status: "DONE", amountInCents: "15000" },
    })

    await expect(
      client.decodePixQr({ externalAccountId: "church-1", payload: "pix" })
    ).rejects.toMatchObject({ code: "CHURCH_BANKING_INVALID_RESPONSE" })
  })

  it("reads a reserved QR without a provider transaction id", async () => {
    const input = payInput()
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: input.externalAccountId,
        externalReference: input.externalReference,
        description: input.description,
        amountInCents: 15000,
        status: "RESERVED",
      },
    })

    await expect(client.payPixQr(input)).resolves.toEqual({
      externalAccountId: input.externalAccountId,
      externalReference: input.externalReference,
      description: input.description,
      amountInCents: 15000,
      status: "RESERVED",
    })
  })

  it("reads a creation failure that carries the provider error code", async () => {
    const input = payInput()
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: input.externalAccountId,
        externalReference: input.externalReference,
        description: input.description,
        amountInCents: 15000,
        status: "CREATION_FAILED",
        errorCode: "ASAAS_PIX_QR_PAYMENT_REJECTED",
      },
    })

    await expect(client.payPixQr(input)).resolves.toMatchObject({
      status: "CREATION_FAILED",
      errorCode: "ASAAS_PIX_QR_PAYMENT_REJECTED",
    })
  })

  it("rejects a payment whose echoed description differs from the request", async () => {
    const input = payInput()
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: input.externalAccountId,
        externalReference: input.externalReference,
        description: "Otra descripción",
        amountInCents: 15000,
        status: "DONE",
        providerTransactionId: "pix-tx-1",
      },
    })

    await expect(client.payPixQr(input)).rejects.toMatchObject({
      code: "CHURCH_BANKING_INVALID_RESPONSE",
    })
  })

  it("rejects a created state that omits the provider transaction id", async () => {
    const input = payInput()
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: input.externalAccountId,
        externalReference: input.externalReference,
        description: input.description,
        amountInCents: 15000,
        status: "PENDING",
      },
    })

    await expect(client.payPixQr(input)).rejects.toMatchObject({
      code: "CHURCH_BANKING_INVALID_RESPONSE",
    })
  })

  it("rejects a creation failure without a provider error code", async () => {
    const input = payInput()
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: input.externalAccountId,
        externalReference: input.externalReference,
        description: input.description,
        amountInCents: 15000,
        status: "CREATION_UNKNOWN",
      },
    })

    await expect(client.payPixQr(input)).rejects.toMatchObject({
      code: "CHURCH_BANKING_INVALID_RESPONSE",
    })
  })

  it("rejects a status answer that omits the echoed description", async () => {
    const client = clientReturning({
      code: "OK",
      data: {
        externalAccountId: "church-1",
        externalReference: "urn:recurringPayment:rp-1:2026-10",
        amountInCents: 15000,
        status: "DONE",
        providerTransactionId: "pix-tx-1",
      },
    })

    await expect(
      client.getPixQrStatus({
        externalAccountId: "church-1",
        externalReference: "urn:recurringPayment:rp-1:2026-10",
      })
    ).rejects.toMatchObject({ code: "CHURCH_BANKING_INVALID_RESPONSE" })
  })
})

function payInput() {
  return {
    externalAccountId: "church-1",
    externalReference: "urn:recurringPayment:rp-1:2026-10",
    payload: "pix-original",
    description: "Aluguel",
  }
}
