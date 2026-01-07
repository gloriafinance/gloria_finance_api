import { Supplier } from "../Supplier"
import { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface ISupplierRepository extends IRepository<Supplier> {
  all(churchId: string): Promise<Supplier[]>
}
