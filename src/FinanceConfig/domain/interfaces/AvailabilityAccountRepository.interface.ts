import { AvailabilityAccount } from "@/Financial/domain"
import { type IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IAvailabilityAccountRepository extends IRepository<AvailabilityAccount> {
  deleteByAvailabilityAccountId(availabilityAccountId: string): Promise<void>
}
