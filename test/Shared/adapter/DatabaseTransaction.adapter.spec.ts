import { DatabaseTransaction } from "@/Shared/adapter/DatabaseTransaction.adapter"
import { MongoTransaction } from "@abejarano/ts-mongodb-criteria"

describe("DatabaseTransaction", () => {
  const originalDriver = process.env.DRIVER_DB

  afterEach(() => {
    jest.restoreAllMocks()

    if (originalDriver === undefined) {
      delete process.env.DRIVER_DB
      return
    }

    process.env.DRIVER_DB = originalDriver
  })

  it("uses the Mongo transaction implementation when DRIVER_DB is mongo", async () => {
    process.env.DRIVER_DB = "mongo"
    const transaction = {} as MongoTransaction
    const run = jest
      .spyOn(MongoTransaction, "run")
      .mockImplementation(async (callback) => callback(transaction))

    await expect(
      DatabaseTransaction.run(async (context) => context)
    ).resolves.toBe(transaction)

    expect(run).toHaveBeenCalledTimes(1)
  })

  it("rejects unsupported database drivers", async () => {
    process.env.DRIVER_DB = "postgres"

    await expect(
      DatabaseTransaction.run(async () => undefined)
    ).rejects.toMatchObject({
      message: "Unsupported database driver: postgres",
    })
  })
})
