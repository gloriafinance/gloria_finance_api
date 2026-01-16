import { Logger } from "@/Shared/adapter"
import {
  IScheduleItemRepository,
  type ListScheduleEventsFiltersRequest,
  ScheduleEvent,
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
    request: ListScheduleEventsFiltersRequest
  ): Promise<Paginate<ScheduleEvent>> {
    this.logger.info("Listing schedule item configurations", request)

    return await this.scheduleItemRepository.list(this.prepareCriteria(request))
  }

  private prepareCriteria(request: ListScheduleEventsFiltersRequest) {
    const filters: Array<Map<string, any>> = []
    const normalizedIsActive = this.normalizeBoolean(request?.isActive)

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

    if (normalizedIsActive !== undefined) {
      filters.push(
        new Map<string, any>([
          ["field", "isActive"],
          ["operator", Operator.EQUAL],
          ["value", normalizedIsActive],
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

  private normalizeBoolean(value?: unknown): boolean | undefined {
    if (typeof value === "boolean") return value
    if (typeof value === "number") {
      return value === 1 ? true : value === 0 ? false : undefined
    }
    if (typeof value === "string") {
      const normalized = value.toLowerCase()
      if (["true", "1"].includes(normalized)) return true
      if (["false", "0"].includes(normalized)) return false
    }
    return undefined
  }
}
