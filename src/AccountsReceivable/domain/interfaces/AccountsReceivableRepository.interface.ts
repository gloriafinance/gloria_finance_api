import { AccountReceivable } from "../AccountReceivable"
import {
  type AccountReceivableDashboardType,
  AccountReceivableType,
  AccountsReceivableStatus,
} from "@/AccountsReceivable/domain"
import { type IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IAccountsReceivableRepository extends IRepository<AccountReceivable> {
  countByDebtorAndStatus(params: {
    churchId: string
    debtorDni: string
    statuses?: AccountsReceivableStatus[]
    types?: AccountReceivableType[]
  }): Promise<number>

  sumPaidInstallmentsByDebtorAndDateRanges(params: {
    churchId: string
    debtorDni: string
    types?: AccountReceivableType[]
    yearRange: { start: Date; end: Date }
    monthRange: { start: Date; end: Date }
  }): Promise<{ contributedYear: number; contributedMonth: number }>

  dashboardAccountReceivable(
    churchId: string
  ): Promise<AccountReceivableDashboardType | null>
}
