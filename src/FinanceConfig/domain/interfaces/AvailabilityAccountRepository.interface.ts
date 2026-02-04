import { AvailabilityAccount } from "@/Financial/domain"
import {
  Criteria,
  type IRepository,
  type Paginate,
} from "@abejarano/ts-mongodb-criteria"

export interface IAvailabilityAccountRepository extends IRepository<AvailabilityAccount> {
  list(filter: object): Promise<AvailabilityAccount[]>
  list(criteria: Criteria): Promise<Paginate<AvailabilityAccount>>
}
