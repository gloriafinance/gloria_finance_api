import { Supplier } from "../Supplier"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface ISupplierRepository {
  upsert(supplier: Supplier): Promise<void>

  list(criteria: Criteria): Promise<Paginate<Supplier>>

  one(filter: object): Promise<Supplier | null>

  all(churchId: string): Promise<Supplier[]>
}
