import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Customer } from "@/Customers/domain/Customer"
import { ICustomerRepository } from "@/Customers/domain/interfaces/CustomerRepository.interface"
import { Collection } from "mongodb"

export class CustomerMongoRepository
  extends MongoRepository<Customer>
  implements ICustomerRepository
{
  private static instance: CustomerMongoRepository

  private constructor() {
    super(Customer)
  }

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

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
