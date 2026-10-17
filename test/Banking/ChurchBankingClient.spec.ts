import { ChurchBankingClient } from "@/Banking/infrastructure/church-banking/ChurchBankingClient.ts"
import type { ConnectExternalAccountResponse } from "@/Banking/domain"

// The encrypted transport is not under test here and `jose` is ESM-only while
// jest runs as CommonJS, so importing the client would otherwise fail.
jest.mock("jose", () => ({
  CompactEncrypt: class {},
  SignJWT: class {},
  importJWK: jest.fn(),
}))

type ConnectResponseParser = {
  parseConnectExternalAccountResponse(
    value: unknown
  ): ConnectExternalAccountResponse
}

type ExecuteCommand = {
  path: string
  payload: unknown
}

/**
 * `execute` owns the encrypted transport, which is exercised elsewhere. These
 * tests assert the command the public method builds and the answer it parses.
 */
function setup(response: unknown) {
  const client = new ChurchBankingClient()
  const execute = jest.spyOn(
    client as unknown as { execute(command: ExecuteCommand): Promise<unknown> },
    "execute"
  )
  execute.mockResolvedValue(response)
  return { client, execute }
}

const bankSlip = {
  identificationField: "03399201595100529040147600301023888440000421177",
  valueInCents: 421177,
  originalValueInCents: 421177,
  dueDate: "2021-12-24",
  companyName: "Fornecedor",
  bank: "033",
  beneficiaryCpfCnpj: "19.540.550/0001-21",
  beneficiaryName: "ASAAS GESTAO FINANCEIRA S.A.",
  allowChangeValue: false,
  minValueInCents: 421177,
  maxValueInCents: 421177,
  discountValueInCents: 0,
  interestValueInCents: 0,
  fineValueInCents: 0,
  totalDiscountValueInCents: 0,
  totalAdditionalValueInCents: 0,
  isOverdue: false,
}

describe("ChurchBankingClient", () => {
  it("accepts the complete external-account connection response", () => {
    const parser = new ChurchBankingClient() as unknown as ConnectResponseParser

    const response = parser.parseConnectExternalAccountResponse({
      accountId: "account-1",
      externalAccountId: "church-123",
      status: "ACTIVE",
      connectionMode: "EXTERNAL_API_KEY",
      accountNumber: {
        agency: "0001",
        account: "6752296",
        accountDigit: "1",
      },
      availableBalanceInCents: 12345,
    })

    expect(response).toEqual({
      accountId: "account-1",
      externalAccountId: "church-123",
      status: "ACTIVE",
      connectionMode: "EXTERNAL_API_KEY",
      accountNumber: {
        codeBank: "461",
        agency: "0001",
        account: "6752296",
        accountDigit: "1",
      },
      availableBalanceInCents: 12345,
    })
  })

  describe("simulateBill", () => {
    it("sends only the typed line to the simulation endpoint", async () => {
      const { client, execute } = setup({
        code: "OK",
        data: { feeInCents: 0, bankSlip },
      })

      await client.simulateBill({
        externalAccountId: "church-1",
        identificationField: "03399201595100529040147600301023888440000421177",
      })

      expect(execute).toHaveBeenCalledWith({
        path: "/api/bill-payments/simulate",
        payload: {
          externalAccountId: "church-1",
          identificationField:
            "03399201595100529040147600301023888440000421177",
        },
      })
    })

    it("sends only the barcode to the simulation endpoint", async () => {
      const { client, execute } = setup({
        code: "OK",
        data: { feeInCents: null, bankSlip: null },
      })

      await client.simulateBill({
        externalAccountId: "church-1",
        barCode: "03391815100000029909777729900000000475110101",
      })

      expect(execute).toHaveBeenCalledWith({
        path: "/api/bill-payments/simulate",
        payload: {
          externalAccountId: "church-1",
          barCode: "03391815100000029909777729900000000475110101",
        },
      })
    })

    it("parses the complete boleto snapshot", async () => {
      const { client } = setup({
        code: "OK",
        data: {
          minimumScheduleDate: "2021-11-22",
          feeInCents: 0,
          bankSlip,
        },
      })

      await expect(
        client.simulateBill({
          externalAccountId: "church-1",
          identificationField: "line",
        })
      ).resolves.toEqual({
        minimumScheduleDate: "2021-11-22",
        feeInCents: 0,
        bankSlip,
      })
    })

    it("keeps the snapshot nullable and omittable as the provider sends it", async () => {
      const { client } = setup({
        code: "OK",
        data: {
          minimumScheduleDate: null,
          feeInCents: null,
          bankSlip: {
            identificationField: null,
            valueInCents: null,
            originalValueInCents: null,
            dueDate: null,
            companyName: null,
            bank: null,
            beneficiaryCpfCnpj: null,
            beneficiaryName: null,
            allowChangeValue: null,
            minValueInCents: null,
            maxValueInCents: null,
            discountValueInCents: null,
            interestValueInCents: null,
            fineValueInCents: null,
            totalDiscountValueInCents: null,
            totalAdditionalValueInCents: null,
            isOverdue: null,
          },
        },
      })

      await expect(
        client.simulateBill({
          externalAccountId: "church-1",
          barCode: "barcode",
        })
      ).resolves.toEqual({
        minimumScheduleDate: null,
        feeInCents: null,
        bankSlip: {
          identificationField: null,
          valueInCents: null,
          originalValueInCents: null,
          dueDate: null,
          companyName: null,
          bank: null,
          beneficiaryCpfCnpj: null,
          beneficiaryName: null,
          allowChangeValue: null,
          minValueInCents: null,
          maxValueInCents: null,
          discountValueInCents: null,
          interestValueInCents: null,
          fineValueInCents: null,
          totalDiscountValueInCents: null,
          totalAdditionalValueInCents: null,
          isOverdue: null,
        },
      })
    })

    it("accepts a response without minimumScheduleDate, feeInCents or bankSlip", async () => {
      const { client } = setup({ code: "OK", data: {} })

      await expect(
        client.simulateBill({
          externalAccountId: "church-1",
          identificationField: "line",
        })
      ).resolves.toEqual({
        minimumScheduleDate: undefined,
        feeInCents: undefined,
        bankSlip: undefined,
      })
    })

    it("rejects a response without provider data", async () => {
      const { client } = setup({ code: "OK" })

      await expect(
        client.simulateBill({
          externalAccountId: "church-1",
          identificationField: "line",
        })
      ).rejects.toMatchObject({ code: "CHURCH_BANKING_INVALID_RESPONSE" })
    })
  })

  describe("createPixTransfer", () => {
    it("sends exactly the PIX contract church-banking accepts", async () => {
      const input = {
        externalAccountId: "church-1",
        amountInCents: 12345,
        pixKey: "12345678000190",
        pixKeyType: "CNPJ" as const,
        description: "Energy",
        externalReference: "urn:recurringPayment:recurring-1:2026-10",
      }
      const { client, execute } = setup({
        code: "OK",
        data: {
          ...input,
          status: "PENDING",
          providerTransferId: "transfer-1",
          transactionReceiptUrl: null,
        },
      })

      await client.createPixTransfer(input)

      expect(execute).toHaveBeenCalledWith({
        path: "/api/pix-transfers",
        payload: input,
      })
      expect(execute.mock.calls[0]?.[0].payload).not.toHaveProperty("context")
    })
  })

  describe("createBillPayment", () => {
    const input = {
      externalAccountId: "church-1",
      identificationField: "34191...",
      description: "Energy",
      externalReference: "urn:recurringPayment:recurring-1:2026-10",
    }

    it("sends exactly the bill contract church-banking accepts", async () => {
      const { client, execute } = setup({
        code: "OK",
        data: {
          ...input,
          status: "PENDING",
          valueInCents: 74283,
          providerBillId: "bill-1",
          paymentDate: null,
          transactionReceiptUrl: null,
        },
      })

      await client.createBillPayment(input)

      expect(execute).toHaveBeenCalledWith({
        path: "/api/bill-payments",
        payload: input,
      })
      const payload = execute.mock.calls[0]?.[0].payload
      expect(payload).not.toHaveProperty("context")
      expect(payload).not.toHaveProperty("expectedAmountInCents")
      expect(payload).not.toHaveProperty("amount")
    })

    it("returns the provider-confirmed amount", async () => {
      const { client } = setup({
        code: "OK",
        data: {
          ...input,
          status: "PAID",
          valueInCents: 78243,
          providerBillId: "bill-1",
          paymentDate: "2026-10-01",
          transactionReceiptUrl: "https://www.asaas.com/receipt/1",
        },
      })

      await expect(client.createBillPayment(input)).resolves.toMatchObject({
        status: "PAID",
        valueInCents: 78243,
      })
    })

    it.each([
      [{ status: "RESERVED" }],
      [{ status: "CREATING" }],
      [{ status: "CREATION_FAILED", errorCode: "BILL_INVALID" }],
      [{ status: "CREATION_UNKNOWN", errorCode: "TIMEOUT" }],
    ])("accepts a bill state without a provider amount (%o)", async (state) => {
      const { client } = setup({ code: "OK", data: { ...input, ...state } })

      await expect(client.createBillPayment(input)).resolves.toMatchObject(
        state
      )
    })

    it.each([
      [{ status: "PENDING", valueInCents: 0 }],
      [{ status: "PENDING" }],
      [{ status: "BANK_PROCESSING", valueInCents: 742.83 }],
    ])(
      "rejects a confirmed bill without a usable provider amount (%o)",
      async (state) => {
        const { client } = setup({
          code: "OK",
          data: {
            ...input,
            providerBillId: "bill-1",
            paymentDate: null,
            transactionReceiptUrl: null,
            ...state,
          },
        })

        await expect(client.createBillPayment(input)).rejects.toMatchObject({
          code: "CHURCH_BANKING_INVALID_RESPONSE",
        })
      }
    )
  })
})
