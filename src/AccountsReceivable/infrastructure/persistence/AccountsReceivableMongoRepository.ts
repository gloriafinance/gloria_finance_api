import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  AccountReceivable,
  type IAccountsReceivableRepository,
} from "../../domain"
import { Collection } from "mongodb"

export class AccountsReceivableMongoRepository
  extends MongoRepository<AccountReceivable>
  implements IAccountsReceivableRepository
{
  private static instance: AccountsReceivableMongoRepository

  private constructor() {
    super(AccountReceivable)
  }

  public static getInstance(): AccountsReceivableMongoRepository {
    if (AccountsReceivableMongoRepository.instance) {
      return AccountsReceivableMongoRepository.instance
    }
    AccountsReceivableMongoRepository.instance =
      new AccountsReceivableMongoRepository()
    return AccountsReceivableMongoRepository.instance
  }

  collectionName(): string {
    return "accounts_receivable"
  }
  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({ accountReceivableId: 1 }, { unique: true })
  }
}
