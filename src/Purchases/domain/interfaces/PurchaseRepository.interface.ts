import { Purchase } from "../Purchase"
import type { Purchase as PurchaseModel } from "../models"
import { Criteria, type Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IPurchaseRepository {
  upsert(purchase: Purchase): Promise<void>

  list(criteria: Criteria): Promise<Paginate<PurchaseModel>>

  list(purchaseIds: string[]): Promise<Purchase[]>

  delete(purchaseIds: string[]): Promise<void>
}
