import { RecurringPayments } from "@/Financial/domain/RecurringPayments"

const base = {
  churchId: "church-1",
  financialConceptId: "concept-1",
  name: "Aluguel",
  dayOfMonth: 10,
  status: "ACTIVE" as const,
}

describe("RecurringPayments", () => {
  it("creates a fixed PIX recurrence with its configured amount", () => {
    const recurrence = RecurringPayments.create({
      ...base,
      type: "FIXED",
      amount: 3500,
      payment: {
        method: "PIX",
        pixKey: "finance@example.org",
        pixKeyType: "EMAIL",
      },
    })

    expect(recurrence.getAmount()).toBe(3500)
    expect(recurrence.getPayment()).toEqual({
      method: "PIX",
      pixKey: "finance@example.org",
      pixKeyType: "EMAIL",
    })
    expect(recurrence.getCurrentPayment()).toBeUndefined()
  })

  it("creates a variable bill recurrence without a permanent amount or PIX key", () => {
    const recurrence = RecurringPayments.create({
      ...base,
      type: "VARIABLE",
      payment: { method: "BILL" },
    })

    expect(recurrence.getAmount()).toBeUndefined()
    expect(recurrence.getPayment()).toEqual({ method: "BILL" })
  })

  it("creates a variable PIX recurrence without a permanent amount", () => {
    const recurrence = RecurringPayments.create({
      ...base,
      type: "VARIABLE",
      payment: { method: "PIX", pixKey: "pix-key", pixKeyType: "EVP" },
    })

    expect(recurrence.getAmount()).toBeUndefined()
    expect(recurrence.getPayment().method).toBe("PIX")
  })
})
