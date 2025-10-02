import { AccountReceivable } from "../AccountReceivable"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IAccountsReceivableRepository {
  list(criteria: Criteria): Promise<Paginate<AccountReceivable>>

  one(filter: object): Promise<AccountReceivable | undefined>

  upsert(accountReceivable: AccountReceivable): Promise<void>
}
