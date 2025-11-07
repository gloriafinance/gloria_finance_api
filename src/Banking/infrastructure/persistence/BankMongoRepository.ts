import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { IBankRepository } from "@/Banking/domain/"
import { Bank } from "@/Banking/domain/Bank"

export class BankMongoRepository
  extends MongoRepository<any>
  implements IBankRepository
{
  private static instance: BankMongoRepository

  constructor() {
    super()
  }

  static getInstance(): BankMongoRepository {
    if (!BankMongoRepository.instance) {
      BankMongoRepository.instance = new BankMongoRepository()
    }
    return BankMongoRepository.instance
  }

  collectionName(): string {
    return "churches"
  }

  async upsert(bank: Bank): Promise<void> {
    const collection = await this.collection()

    await collection.updateOne(
      { churchId: bank.getChurchId() },
      { $pull: { banks: { bankId: bank.getBankId() } } }
    )

    await collection.updateOne(
      { churchId: bank.getChurchId() },
      { $push: { banks: bank.toPrimitives() } },
      { upsert: true }
    )
  }

  async one(bankId: string): Promise<Bank | undefined> {
    const collection = await this.collection()

    const result = await collection.findOne<any>(
      { "banks.bankId": bankId },
      { projection: { _id: 1, churchId: 1, "banks.$": 1 } }
    )

    if (!result) {
      return undefined
    }

    return Bank.fromPrimitives({
      id: result._id.toString(),
      churchId: result.churchId,
      ...result.banks[0],
    })
  }

  async list(churchId: string): Promise<Bank[]> {
    const collection = await this.collection()

    const result = await collection.findOne<any>(
      {
        churchId,
      },
      {
        projection: {
          _id: 1,
          churchId: 1,
          banks: 1,
        },
      }
    )

    if (!("banks" in result)) {
      return []
    }

    return result.banks.map((bank: any) =>
      Bank.fromPrimitives({
        id: result._id.toString(),
        churchId: result.churchId,
        ...bank,
      })
    )
  }
}
