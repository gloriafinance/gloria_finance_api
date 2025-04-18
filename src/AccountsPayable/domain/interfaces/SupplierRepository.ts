import { Supplier } from "../Supplier"
import { Criteria, Paginate } from "@/Shared/domain"

export interface ISupplierRepository {
  upsert(supplier: Supplier): Promise<void>

  list(criteria: Criteria): Promise<Paginate<Supplier>>

  one(filter: object): Promise<Supplier | null>
}
