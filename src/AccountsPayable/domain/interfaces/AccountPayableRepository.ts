import type { IRepository } from "@abejarano/ts-mongodb-criteria"
import {
  AccountPayable,
  type AccountPayablesDashboardType,
} from "@/AccountsPayable/domain"

export interface IAccountPayableRepository extends IRepository<AccountPayable> {
  dashboardAccountPayable(
    churchId: string
  ): Promise<AccountPayablesDashboardType | null>
}
