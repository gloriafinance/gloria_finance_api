import { GenericException } from "@/Shared/domain"
import { MongoTransaction } from "@abejarano/ts-mongodb-criteria"

export type DatabaseTransactionContext = MongoTransaction

export class DatabaseTransaction {
  static async run<T>(
    callback: (transaction: DatabaseTransactionContext) => Promise<T>
  ): Promise<T> {
    const driver = (process.env.DRIVER_DB ?? "mongo").toLowerCase()

    if (driver === "mongo") {
      return MongoTransaction.run(callback)
    }

    throw new GenericException(`Unsupported database driver: ${driver}`)
  }
}
