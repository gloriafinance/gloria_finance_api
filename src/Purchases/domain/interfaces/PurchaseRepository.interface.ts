import { Purchase } from "../Purchase"
import { Purchase as PurchaseModel } from "../models"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IPurchaseRepository {
  upsert(purchase: Purchase): Promise<void>

  fetch(criteria: Criteria): Promise<Paginate<PurchaseModel>>
}
