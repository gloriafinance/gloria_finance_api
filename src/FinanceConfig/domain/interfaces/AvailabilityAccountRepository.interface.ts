import { AvailabilityAccount } from "@/Financial/domain"
import { Criteria, IRepository, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IAvailabilityAccountRepository extends IRepository<AvailabilityAccount> {
  upsert(availabilityAccount: AvailabilityAccount): Promise<void>

  one(filter: object): Promise<AvailabilityAccount | undefined>

  list(filter: object): Promise<AvailabilityAccount[]>
  list(criteria: Criteria): Promise<Paginate<AvailabilityAccount>>
}
