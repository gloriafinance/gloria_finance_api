import { Customer } from "../Customer"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface ICustomerRepository {
  upsert(customer: Customer): Promise<void>

  one(filter: object): Promise<Customer | undefined>

  list(criteria: Criteria): Promise<Paginate<Customer>>
}
