import { Logger } from "@/Shared/adapter"
import {
  BankStatement,
  IBankStatementRepository,
  ListBankStatementsRequest,
} from "@/Banking/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"

export class ListBankStatements {
  private readonly logger = Logger(ListBankStatements.name)

  constructor(private readonly repository: IBankStatementRepository) {}

  async execute(
    request: ListBankStatementsRequest
  ): Promise<Paginate<BankStatement>> {
    this.logger.info("Listing bank statements", request)

    const criteria = this.prepareCriteria(request)

    return this.repository.list(criteria)
  }

  private prepareCriteria(request: ListBankStatementsRequest): Criteria {
    const filters: Array<Map<string, any>> = []
    const perPage = Number(request.perPage ?? 20)
    const page = Number(request.page ?? 1)

    filters.push(
      new Map<string, any>([
        ["field", "churchId"],
        ["operator", Operator.EQUAL],
        ["value", request.churchId],
      ])
    )

    if (request.bankId) {
      filters.push(
        new Map<string, any>([
          ["field", "bank.bankId"],
          ["operator", Operator.EQUAL],
          ["value", request.bankId],
        ])
      )
    }

    if (request.status) {
      filters.push(
        new Map<string, any>([
          ["field", "reconciliationStatus"],
          ["operator", Operator.EQUAL],
          ["value", request.status],
        ])
      )
    }

    if (typeof request.month === "number") {
      filters.push(
        new Map<string, any>([
          ["field", "month"],
          ["operator", Operator.EQUAL],
          ["value", request.month],
        ])
      )
    }

    if (typeof request.year === "number") {
      filters.push(
        new Map<string, any>([
          ["field", "year"],
          ["operator", Operator.EQUAL],
          ["value", request.year],
        ])
      )
    }

    const { dateFrom, dateTo } = request

    if (dateFrom && dateTo) {
      filters.push(
        new Map<string, any>([
          ["field", "postedAt"],
          ["operator", Operator.BETWEEN],
          ["value", { start: dateFrom, end: dateTo }],
        ])
      )
    } else {
      if (dateFrom) {
        filters.push(
          new Map<string, any>([
            ["field", "postedAt"],
            ["operator", Operator.GTE],
            ["value", dateFrom],
          ])
        )
      }

      if (dateTo) {
        filters.push(
          new Map<string, any>([
            ["field", "postedAt"],
            ["operator", Operator.LTE],
            ["value", dateTo],
          ])
        )
      }
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("postedAt", OrderTypes.DESC),
      perPage,
      page
    )
  }
}
