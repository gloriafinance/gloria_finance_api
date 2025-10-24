import { Logger } from "@/Shared/adapter"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"
import {
  IAssetRepository,
  ListAssetsRequest,
} from "../domain"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"

export class ListAssets {
  private readonly logger = Logger(ListAssets.name)

  constructor(private readonly repository: IAssetRepository) {}

  async execute(request: ListAssetsRequest) {
    this.logger.info("Listing patrimony assets", request)

    const perPage = Math.max(Number(request.perPage ?? 20), 1)
    const page = Math.max(Number(request.page ?? 1), 1)

    const criteria = this.prepareCriteria(request, { page, perPage })

    const result = await this.repository.list(criteria, { page, perPage })

    return {
      ...result,
      results: result.results.map(mapAssetToResponse),
    }
  }

  private prepareCriteria(
    request: ListAssetsRequest,
    pagination: { page: number; perPage: number }
  ): Criteria {
    const filters: Array<Map<string, unknown>> = []

    if (request.congregationId) {
      filters.push(
        new Map([
          ["field", "congregationId"],
          ["operator", Operator.EQUAL],
          ["value", request.congregationId],
        ])
      )
    }

    if (request.category) {
      filters.push(
        new Map([
          ["field", "category"],
          ["operator", Operator.EQUAL],
          ["value", request.category],
        ])
      )
    }

    if (request.status) {
      filters.push(
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", request.status],
        ])
      )
    }

    const searchTerm =
      typeof request.search === "string" ? request.search.trim() : undefined

    if (searchTerm) {
      const regex = new RegExp(searchTerm, "i")
      filters.push(
        new Map([
          ["field", "$or"],
          ["operator", Operator.EQUAL],
          [
            "value",
            [
              { name: regex },
              { code: regex },
              { responsibleId: regex },
              { location: regex },
            ],
          ],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("createdAt", OrderTypes.DESC),
      pagination.perPage,
      pagination.page
    )
  }
}
