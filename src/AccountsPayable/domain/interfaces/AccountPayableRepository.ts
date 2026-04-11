import type { IRepository } from "@abejarano/ts-mongodb-criteria"
import { AccountPayable } from "@/AccountsPayable/domain"

export interface IAccountPayableRepository extends IRepository<AccountPayable> {}
