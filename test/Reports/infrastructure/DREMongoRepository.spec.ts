import { DREMongoRepository } from "@/Reports/infrastructure/persistence/DREMongoRepository"

/**
 * A late booking into a closed month is recorded and the period's snapshot is
 * dropped, so the report recomputes instead of staying wrong. This exercises the
 * write, because a missing import here would only show up at runtime.
 */
describe("DREMongoRepository.invalidate", () => {
  const deleteOne = jest.fn()
  const repository = DREMongoRepository.getInstance()

  beforeEach(() => {
    jest.clearAllMocks()
    deleteOne.mockResolvedValue({ deletedCount: 1 })
    jest
      .spyOn(repository as never, "collection")
      .mockResolvedValue({ deleteOne } as never)
  })

  it("drops the snapshot of the period so the report recomputes", async () => {
    await repository.invalidate({ churchId: "church-1", month: 10, year: 2026 })

    expect(deleteOne).toHaveBeenCalledWith({
      churchId: "church-1",
      month: 10,
      year: 2026,
    })
  })
})
