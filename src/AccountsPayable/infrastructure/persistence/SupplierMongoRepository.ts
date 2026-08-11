import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { type ISupplierRepository, Supplier } from "@/AccountsPayable/domain"
import { Collection } from "mongodb"

export class SupplierMongoRepository
  extends MongoRepository<Supplier>
  implements ISupplierRepository
{
  private static instance: SupplierMongoRepository

  private constructor() {
    super(Supplier)
  }

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

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
