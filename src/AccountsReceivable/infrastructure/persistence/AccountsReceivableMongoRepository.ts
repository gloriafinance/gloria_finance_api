import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { AccountReceivable, IAccountsReceivableRepository } from "../../domain"

export class AccountsReceivableMongoRepository
  extends MongoRepository<AccountReceivable>
  implements IAccountsReceivableRepository
{
  private static instance: AccountsReceivableMongoRepository

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

  async list(criteria: Criteria): Promise<Paginate<AccountReceivable>> {
    const result = await this.searchByCriteria<AccountReceivable>(criteria)
    return this.paginate<AccountReceivable>(result)
  }

  async one(filter: object): Promise<AccountReceivable | undefined> {
    const collection = await this.collection()

    const result = await collection.findOne(filter)

    return result
      ? AccountReceivable.fromPrimitives({
          ...result,
          id: result._id.toString(),
        })
      : undefined
  }

  async upsert(accountReceivable: AccountReceivable): Promise<void> {
    await this.persist(accountReceivable.getId(), accountReceivable)
  }
}
