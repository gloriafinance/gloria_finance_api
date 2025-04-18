import { MongoRepository } from "@/Shared/infrastructure"
import { ISupplierRepository, Supplier } from "@/AccountsPayable/domain"
import { Criteria, Paginate } from "@/Shared/domain"

export class SupplierMongoRepository
  extends MongoRepository<Supplier>
  implements ISupplierRepository
{
  private static instance: SupplierMongoRepository

  public static getInstance(): SupplierMongoRepository {
    if (SupplierMongoRepository.instance) {
      return SupplierMongoRepository.instance
    }
    SupplierMongoRepository.instance = new SupplierMongoRepository()
    return SupplierMongoRepository.instance
  }

  collectionName(): string {
    return "supplier"
  }

  async upsert(supplier: Supplier): Promise<void> {
    await this.persist(supplier.getId(), supplier)
  }

  async list(criteria: Criteria): Promise<Paginate<Supplier | undefined>> {
    const result = await this.searchByCriteria<Supplier>(criteria)
    return this.buildPaginate<Supplier>(result)
  }

  async one(filter: object): Promise<Supplier | null> {
    const collection = await this.collection()

    const result = await collection.findOne(filter)

    return result
      ? Supplier.fromPrimitives({
          ...result,
          id: result._id.toString(),
        })
      : undefined
  }

  async all(churchId: string): Promise<Supplier[]> {
    const collection = await this.collection()

    const result = await collection.find({ churchId }).toArray()

    return result.map((item) =>
      Supplier.fromPrimitives({
        ...item,
        id: item._id.toString(),
      })
    )
  }
}
