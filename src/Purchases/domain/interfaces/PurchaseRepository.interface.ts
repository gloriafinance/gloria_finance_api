import { Purchase } from "../Purchase"

export interface IPurchaseRepository {
  upsert(purchase: Purchase): Promise<void>
}
