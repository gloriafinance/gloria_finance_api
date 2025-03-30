import { AccountReceivable } from "../AccountReceivable"
import { Criteria, Paginate } from "@/Shared/domain"

export interface IAccountsReceivableRepository {
  list(criteria: Criteria): Promise<Paginate<AccountReceivable>>

  one(accountReceivableId: string): Promise<AccountReceivable | undefined>

  upsert(accountReceivable: AccountReceivable): Promise<void>
}
