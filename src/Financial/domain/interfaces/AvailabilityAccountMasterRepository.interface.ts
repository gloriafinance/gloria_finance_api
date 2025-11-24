import { AvailabilityAccountMaster } from "@/Financial/domain"

export interface IAvailabilityAccountMasterRepository {
  one(
    availabilityAccountMasterId: string
  ): Promise<AvailabilityAccountMaster | undefined>

  search(
    churchId: string,
    month: number,
    year: number
  ): Promise<AvailabilityAccountMaster[] | undefined>

  upsert(accountMaster: AvailabilityAccountMaster): Promise<void>

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
