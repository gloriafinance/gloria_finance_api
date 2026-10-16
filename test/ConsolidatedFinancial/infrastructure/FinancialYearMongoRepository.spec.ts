import { MongoTransaction } from "@abejarano/ts-mongodb-criteria"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure/persistence/FinancialYearMongoRepository"

/**
 * These two writes are what the close and the reservation depend on at runtime.
 * A missing import in this file is invisible to a green formatting check and only
 * shows up as a ReferenceError in production, so the calls are exercised here.
 */
describe("FinancialYearMongoRepository closing writes", () => {
  const updateOne = jest.fn()
  const findOneAndUpdate = jest.fn()
  const repository = FinancialYearMongoRepository.getInstance()

  beforeEach(() => {
    jest.clearAllMocks()
    updateOne.mockResolvedValue({ modifiedCount: 1 })
    findOneAndUpdate.mockResolvedValue({ reservationSeq: 3 })
    jest
      .spyOn(repository as never, "collection")
      .mockResolvedValue({ updateOne, findOneAndUpdate } as never)
  })

  it("bumps the reservation sequence inside the given transaction", async () => {
    const session = { id: "session-1" }
    jest.spyOn(MongoTransaction, "sessionFor").mockReturnValue(session as never)

    await expect(
      repository.markReservation({
        churchId: "church-1",
        month: 10,
        year: 2026,
      })
    ).resolves.toBe(true)

    expect(MongoTransaction.sessionFor).toHaveBeenCalled()
    expect(updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: "church-1", month: 10, year: 2026 }),
      { $inc: { reservationSeq: 1 } },
      { session }
    )
  })

  it("finishes the close with a timestamp", async () => {
    await expect(
      repository.finishClosing({
        churchId: "church-1",
        month: 10,
        year: 2026,
        closedBy: "user-1",
        expectedReservationSeq: 3,
      })
    ).resolves.toBe(true)

    const options = updateOne.mock.calls[0]![1] as {
      $set: { closedAt?: unknown; closed?: boolean }
    }
    expect(options.$set.closed).toBe(true)
    // DateBR() has to be in scope: without its import this line never runs.
    expect(options.$set.closedAt).toBeDefined()
  })

  it("claims the month and returns the sequence that travels with it", async () => {
    await expect(
      repository.claimClosing({ churchId: "church-1", month: 10, year: 2026 })
    ).resolves.toBe(3)
  })
})
