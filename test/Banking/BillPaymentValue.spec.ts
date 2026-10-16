import { assertBilledValue } from "@/Banking/domain/BillPaymentValue.ts"

describe("assertBilledValue", () => {
  const base = {
    externalAccountId: "church-1",
    externalReference: "ref-1",
    context: {},
  }

  it("accepts an answered bill with a positive integer amount", () => {
    expect(
      assertBilledValue({ ...base, status: "PENDING", valueInCents: 74283 })
    ).toMatchObject({ valueInCents: 74283 })
  })

  it.each([[undefined], [0], [-100], [742.83]])(
    "refuses an accepted bill without a usable amount (%s)",
    (valueInCents) => {
      // Without the amount the debit could never be booked, so this is not an
      // accepted operation.
      expect(() =>
        assertBilledValue({
          ...base,
          status: "PENDING",
          valueInCents,
        } as never)
      ).toThrow("CHURCH_BANKING_INVALID_RESPONSE")
    }
  )

  it("does not require an amount when the provider confirms a failure", () => {
    expect(
      assertBilledValue({ ...base, status: "CREATION_FAILED" })
    ).toMatchObject({ status: "CREATION_FAILED" })
  })
})
