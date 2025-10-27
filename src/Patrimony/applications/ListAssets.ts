import { Logger } from "@/Shared/adapter"
import {
  Criteria,
  Filters,
  Operator,
  OrCondition,
  Order,
  OrderTypes,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { AssetModel, IAssetRepository, ListAssetsRequest } from "../domain"

export class ListAssets {
  private readonly logger = Logger(ListAssets.name)

  constructor(private readonly repository: IAssetRepository) {}

  async execute(request: ListAssetsRequest): Promise<Paginate<AssetModel>> {
    this.logger.info("Listing patrimony assets", request)

    const perPage = Number(request.perPage ?? 20)
    const page = Number(request.page ?? 1)

    const criteria = this.prepareCriteria(request, { page, perPage })

    return await this.repository.list(criteria)

    // return {
    //   ...result,
    //   results: result.results.map(mapAssetToResponse),
    // }
  }

  private prepareCriteria(
    request: ListAssetsRequest,
    pagination: { page: number; perPage: number }
  ): Criteria {
    type FilterValue = string | number | boolean | OrCondition[] | Operator

    const filters: Array<Map<string, any>> = []

    if (request.churchId) {
      filters.push(
        new Map<string, FilterValue>([
          ["field", "churchId"],
          ["operator", Operator.EQUAL],
          ["value", request.churchId],
        ])
      )
    }

    if (request.category) {
      filters.push(
        new Map<string, FilterValue>([
          ["field", "category"],
          ["operator", Operator.EQUAL],
          ["value", request.category],
        ])
      )
    }

    if (request.status) {
      filters.push(
        new Map<string, FilterValue>([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", request.status],
        ])
      )
    }

    const searchTerm =
      typeof request.search === "string" ? request.search.trim() : undefined

    if (searchTerm) {
      const searchConditions: OrCondition[] = [
        { field: "name", operator: Operator.CONTAINS, value: searchTerm },
        { field: "code", operator: Operator.CONTAINS, value: searchTerm },
        {
          field: "responsibleId",
          operator: Operator.CONTAINS,
          value: searchTerm,
        },
        {
          field: "responsible.memberId",
          operator: Operator.CONTAINS,
          value: searchTerm,
        },
        {
          field: "responsible.name",
          operator: Operator.CONTAINS,
          value: searchTerm,
        },
        { field: "location", operator: Operator.CONTAINS, value: searchTerm },
      ]

      filters.push(
        new Map<string, FilterValue>([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", searchConditions],
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
