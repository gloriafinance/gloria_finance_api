import { AccountReceivable } from "../AccountReceivable"
import { AccountReceivableType } from "../enums/AccountReceivableType.enum"
import { AccountsReceivableStatus } from "../enums/AccountsReceivableStatus.enum"
import { IRepository } from "@abejarano/ts-mongodb-criteria"

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
}
