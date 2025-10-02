import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { AccountPayable } from "@/AccountsPayable/domain"

export interface IAccountPayableRepository {
  upsert(accountPayable: AccountPayable): Promise<void>

  one(criteria: object): Promise<AccountPayable | null>

  list(criteria: Criteria): Promise<Paginate<AccountPayable>>
}
