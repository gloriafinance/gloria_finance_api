import { Logger } from "@/Shared/adapter"
import {
  IScheduleItemRepository,
  ListScheduleItemsFiltersRequest,
  ScheduleItem,
} from "@/Schedule/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"

export class ListScheduleItemsConfig {
  private readonly logger = Logger(ListScheduleItemsConfig.name)

  constructor(
    private readonly scheduleItemRepository: IScheduleItemRepository
  ) {}

  async execute(
    request: ListScheduleItemsFiltersRequest
  ): Promise<Paginate<ScheduleItem>> {
    this.logger.info("Listing schedule item configurations", request)

    return await this.scheduleItemRepository.list(this.prepareCriteria(request))
  }

  private prepareCriteria(request: ListScheduleItemsFiltersRequest) {
    const filters: Array<Map<string, any>> = []

    filters.push(
      new Map([
        ["field", "churchId"],
        ["operator", Operator.EQUAL],
        ["value", request.churchId],
      ])
    )
    if (request?.type) {
      filters.push(
        new Map([
          ["field", "type"],
          ["operator", Operator.EQUAL],
          ["value", request.type],
        ])
      )
    }

    if (request?.visibility) {
      filters.push(
        new Map([
          ["field", "visibility"],
          ["operator", Operator.EQUAL],
          ["value", request.visibility],
        ])
      )
    }

    if (request?.isActive !== undefined) {
      filters.push(
        new Map<string, any>([
          ["field", "isActive"],
          ["operator", Operator.EQUAL],
          ["value", request.isActive],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("createdAt", OrderTypes.DESC),
      Number(request.perPage),
      Number(request.page)
    )
  }
}
