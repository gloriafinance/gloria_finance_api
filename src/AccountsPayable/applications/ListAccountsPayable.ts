import {
  FilterAccountPayableRequest,
  IAccountPayableRepository,
} from "@/AccountsPayable/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"
import { Logger } from "@/Shared/adapter"

export class ListAccountsPayable {
  private logger = Logger(ListAccountsPayable.name)

  constructor(private readonly accountPayable: IAccountPayableRepository) {}

  async execute(request: FilterAccountPayableRequest) {
    this.logger.info(`Start List Account Payable`)

    return this.accountPayable.list(this.prepareCriteria(request))
  }

  private prepareCriteria(request: FilterAccountPayableRequest) {
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

    if (request.status) {
      filters.push(
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", request.status],
        ])
      )
    }

    if (request.startDate && !request.endDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "date"],
          ["operator", Operator.GTE],
          ["value", request.startDate],
        ])
      )
    }

    if (!request.startDate && request.endDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "date"],
          ["operator", Operator.LTE],
          ["value", request.endDate],
        ])
      )
    }

    this.logger.info(`Filters: `, Filters.fromValues(filters))

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("createdAt", OrderTypes.DESC),
      request.perPage,
      request.page
    )
  }
}
