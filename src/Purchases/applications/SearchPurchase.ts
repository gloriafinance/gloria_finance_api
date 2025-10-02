import { IPurchaseRepository } from "../domain/interfaces"
import { FilterPurchasesRequest } from "../domain/requests"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { Purchase } from "../domain/models"

export class SearchPurchase {
  constructor(private readonly purchaseRepository: IPurchaseRepository) {}

  async execute(request: FilterPurchasesRequest): Promise<Paginate<Purchase>> {
    return await this.purchaseRepository.fetch(this.prepareCriteria(request))
  }

  private prepareCriteria(request: FilterPurchasesRequest) {
    const filters = []

    if (request.churchId) {
      filters.push(
        new Map([
          ["field", "churchId"],
          ["operator", Operator.EQUAL],
          ["value", request.churchId],
        ])
      )
    }

    if (request.startDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "purchaseDate"],
          ["operator", Operator.GTE],
          ["value", new Date(request.startDate)],
        ])
      )
    }

    if (request.endDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "purchaseDate"],
          ["operator", Operator.LTE],
          ["value", new Date(request.endDate)],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("purchaseDate", OrderTypes.DESC),
      request.perPage,
      request.page
    )
  }
}
