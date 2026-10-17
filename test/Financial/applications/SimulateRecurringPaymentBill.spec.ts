import { SimulateRecurringPaymentBill } from "@/Financial/applications/recurringPayments/SimulateRecurringPaymentBill"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"

function setup(found = true) {
  const recurrence = RecurringPayments.fromPrimitives({
    recurringPaymentId: "recurring-1",
    churchId: "church-1",
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Energy",
    type: "VARIABLE",
    dayOfMonth: 10,
    status: "ACTIVE",
  })
  const repository = {
    one: jest.fn().mockResolvedValue(found ? recurrence : undefined),
    saveIfCurrentPaymentMatches: jest.fn(),
  }
  const simulation = {
    minimumScheduleDate: "2026-10-02",
    feeInCents: 0,
    bankSlip: { valueInCents: 74283, beneficiaryName: "Fornecedor" },
  }
  const banking = { simulateBill: jest.fn().mockResolvedValue(simulation) }

  const service = new SimulateRecurringPaymentBill(
    repository as never,
    banking as never
  )
  return { service, repository, banking, simulation }
}

describe("SimulateRecurringPaymentBill", () => {
  it("forwards the typed line of an ACTIVE recurrence of the authenticated church", async () => {
    const ctx = setup()

    const result = await ctx.service.execute("church-1", "recurring-1", {
      identificationField: "03399201595100529040147600301023888440000421177",
    })

    expect(result).toEqual(ctx.simulation)
    // Ownership and the ACTIVE gate are the lookup itself: another church's
    // recurrence is indistinguishable from a missing one.
    expect(ctx.repository.one).toHaveBeenCalledWith({
      recurringPaymentId: "recurring-1",
      churchId: "church-1",
      status: "ACTIVE",
    })
    expect(ctx.banking.simulateBill).toHaveBeenCalledTimes(1)
    expect(ctx.banking.simulateBill).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      identificationField: "03399201595100529040147600301023888440000421177",
    })
    // Simulation is a read: nothing is reserved or persisted.
    expect(ctx.repository.saveIfCurrentPaymentMatches).not.toHaveBeenCalled()
  })

  it("forwards the barcode", async () => {
    const ctx = setup()

    await ctx.service.execute("church-1", "recurring-1", {
      barCode: "03391815100000029909777729900000000475110101",
    })

    expect(ctx.banking.simulateBill).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      barCode: "03391815100000029909777729900000000475110101",
    })
  })

  it("rejects a recurrence that is missing, inactive or owned by another church", async () => {
    const ctx = setup(false)

    await expect(
      ctx.service.execute("church-1", "recurring-1", {
        identificationField: "line",
      })
    ).rejects.toMatchObject({ name: "RECURRING_PAYMENT_NOT_FOUND" })
    expect(ctx.banking.simulateBill).not.toHaveBeenCalled()
    expect(ctx.repository.saveIfCurrentPaymentMatches).not.toHaveBeenCalled()
  })
})
