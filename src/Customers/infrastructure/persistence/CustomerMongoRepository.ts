import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { Customer } from "@/Customers/domain/Customer"
import { ICustomerRepository } from "@/Customers/domain/interfaces/CustomerRepository.interface"

export class CustomerMongoRepository
  extends MongoRepository<Customer>
  implements ICustomerRepository
{
  private static instance: CustomerMongoRepository

  static getInstance(): CustomerMongoRepository {
    if (CustomerMongoRepository.instance) {
      return CustomerMongoRepository.instance
    }

    CustomerMongoRepository.instance = new CustomerMongoRepository()
    return CustomerMongoRepository.instance
  }

  collectionName(): string {
    return "customers"
  }

  list(criteria: Criteria): Promise<Paginate<Customer>> {
    return Promise.resolve(undefined)
  }

  one(filter: object): Promise<Customer | undefined> {
    return Promise.resolve(undefined)
  }

  upsert(customer: Customer): Promise<void> {
    return Promise.resolve(undefined)
  }
}
