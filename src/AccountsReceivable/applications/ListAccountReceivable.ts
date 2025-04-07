import { Logger } from "@/Shared/adapter"
import {
  AccountReceivable,
  FilterAccountReceivableRequest,
  IAccountsReceivableRepository,
} from "@/AccountsReceivable/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
  Paginate,
} from "@/Shared/domain"

export class ListAccountReceivable {
  private logger = Logger(ListAccountReceivable.name)

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository
  ) {}

  async execute(
    request: FilterAccountReceivableRequest
  ): Promise<Paginate<AccountReceivable>> {
    this.logger.info(`Start List Account Receivable`)

    return this.accountReceivableRepository.list(this.prepareCriteria(request))
  }

  private prepareCriteria(request: FilterAccountReceivableRequest) {
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

    if (request.startDate && request.endDate) {
      filters.push(
        new Map<string, string | any>([
          ["field", "date"],
          ["operator", Operator.DATE_RANGE],
          [
            "value",
            {
              startDate: request.startDate,
              endDate: request.endDate,
            },
          ],
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
