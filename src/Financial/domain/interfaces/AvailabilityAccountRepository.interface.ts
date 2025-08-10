import { AvailabilityAccount } from "../AvailabilityAccount"

export interface IAvailabilityAccountRepository {
  upsert(availabilityAccount: AvailabilityAccount): Promise<void>

  one(filter: object): Promise<AvailabilityAccount | undefined>

  searchAvailabilityAccountsByChurchId(
    churchId: string
  ): Promise<AvailabilityAccount[]>
}
