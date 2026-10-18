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
})
