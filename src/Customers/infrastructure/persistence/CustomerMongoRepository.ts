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

  async list(criteria: Criteria): Promise<Paginate<Customer>> {
    const result = await this.searchByCriteria<Customer>(criteria)
    return this.paginate<Customer>(result)
  }

  async one(filter: object): Promise<Customer | undefined> {
    const collection = await this.collection()
    const data = await collection.findOne(filter)
    if (!data) {
      return undefined
    }
    return Customer.fromPrimitives({ ...data, id: data._id.toString() })
  }

  async upsert(customer: Customer): Promise<void> {
    await this.persist(customer.getId(), customer)
  }
}
