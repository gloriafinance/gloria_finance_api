import { AvailabilityAccountMaster } from "@/Financial/domain"
import type { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IAvailabilityAccountMasterRepository extends IRepository<AvailabilityAccountMaster> {
  search(
    churchId: string,
    month: number,
    year: number
  ): Promise<AvailabilityAccountMaster[] | undefined>

  rebuildAvailabilityAccountsMaster(filter: {
    churchId: string
    year: number
    month: number
  }): Promise<void>

  fetchAvailableAccounts(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<AvailabilityAccountMaster[]>
}
