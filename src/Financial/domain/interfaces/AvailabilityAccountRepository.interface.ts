import { AvailabilityAccount } from "@/Financial/domain"

export interface IAvailabilityAccountRepository {
  upsert(availabilityAccount: AvailabilityAccount): Promise<void>

  one(filter: object): Promise<AvailabilityAccount | undefined>

  list(filter: object): Promise<AvailabilityAccount[]>
}
