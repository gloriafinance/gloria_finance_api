import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  AccountPayable,
  type IAccountPayableRepository,
} from "@/AccountsPayable/domain"
import { Collection } from "mongodb"

export class AccountsPayableMongoRepository
  extends MongoRepository<AccountPayable>
  implements IAccountPayableRepository
{
  private static instance: AccountsPayableMongoRepository

  private constructor() {
    super(AccountPayable)
  }

  public static getInstance(): AccountsPayableMongoRepository {
    if (AccountsPayableMongoRepository.instance) {
      return AccountsPayableMongoRepository.instance
    }
    AccountsPayableMongoRepository.instance =
      new AccountsPayableMongoRepository()
    return AccountsPayableMongoRepository.instance
  }

  collectionName(): string {
    return "accounts_payable"
  }

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
