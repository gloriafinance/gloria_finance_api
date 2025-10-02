import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import {
  AccountPayable,
  IAccountPayableRepository,
} from "@/AccountsPayable/domain"

export class AccountsPayableMongoRepository
  extends MongoRepository<AccountPayable>
  implements IAccountPayableRepository
{
  private static instance: AccountsPayableMongoRepository

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

  async list(criteria: Criteria): Promise<Paginate<AccountPayable>> {
    const result = await this.searchByCriteria<AccountPayable>(criteria)
    return this.paginate<AccountPayable>(result)
  }

  async one(criteria: object): Promise<AccountPayable | null> {
    const collection = await this.collection()

    const result = await collection.findOne(criteria)

    return result
      ? AccountPayable.fromPrimitives({
          ...result,
          id: result._id.toString(),
        })
      : undefined
  }

  async upsert(accountPayable: AccountPayable): Promise<void> {
    await this.persist(accountPayable.getId(), accountPayable)
  }
}
