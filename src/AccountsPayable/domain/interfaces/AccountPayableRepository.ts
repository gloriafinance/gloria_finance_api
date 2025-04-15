import { Criteria, Paginate } from "@/Shared/domain"
import { AccountPayable } from "@/AccountsPayable/domain"

export interface AccountPayableRepository {
  upsert(accountPayable: AccountPayable): Promise<void>

  one(criteria: Object): Promise<AccountPayable | null>

  list(criteria: Criteria): Promise<Paginate<AccountPayable>>
}
