import { Criteria, Paginate } from "@/Shared/domain"
import { AccountPayable } from "@/AccountsPayable/domain"

export interface IAccountPayableRepository {
  upsert(accountPayable: AccountPayable): Promise<void>

  one(criteria: object): Promise<AccountPayable | null>

  list(criteria: Criteria): Promise<Paginate<AccountPayable>>
}
