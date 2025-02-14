import { Purchase } from "../Purchase"
import { Criteria, Paginate } from "../../../Shared/domain"
import { Purchase as PurchaseModel } from "../models"

export interface IPurchaseRepository {
  upsert(purchase: Purchase): Promise<void>

  fetch(criteria: Criteria): Promise<Paginate<PurchaseModel>>
}
