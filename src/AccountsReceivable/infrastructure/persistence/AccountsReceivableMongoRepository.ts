import { MongoRepository } from "@/Shared/infrastructure"
import { AccountReceivable, IAccountsReceivableRepository } from "../../domain"
import { Criteria, Paginate } from "@/Shared/domain"

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
    return this.buildPaginate<AccountReceivable>(result)
  }

  async one(
    accountReceivableId: string
  ): Promise<AccountReceivable | undefined> {
    const collection = await this.collection()

    const result = await collection.findOne({
      accountReceivableId,
    })

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
