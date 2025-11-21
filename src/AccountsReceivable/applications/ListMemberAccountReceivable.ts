import { Logger } from "@/Shared/adapter"
import {
  AccountReceivable,
  AccountReceivableType,
  FilterMemberAccountReceivableRequest,
  IAccountsReceivableRepository,
} from "@/AccountsReceivable/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"

export class ListMemberAccountReceivable {
  private logger = Logger(ListMemberAccountReceivable.name)

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository
  ) {}

  async execute(
    request: FilterMemberAccountReceivableRequest
  ): Promise<Paginate<AccountReceivable>> {
    this.logger.info(
      `Start List Member Account Receivable for debtor ${request.debtorDNI}`
    )

    return this.accountReceivableRepository.list(this.prepareCriteria(request))
  }

  private prepareCriteria(request: FilterMemberAccountReceivableRequest) {
    const filters = []

    filters.push(
      new Map([
        ["field", "churchId"],
        ["operator", Operator.EQUAL],
        ["value", request.churchId],
      ])
    )

    filters.push(
      new Map([
        ["field", "type"],
        ["operator", Operator.EQUAL],
        ["value", request.type || AccountReceivableType.CONTRIBUTION],
      ])
    )

    filters.push(
      new Map([
        ["field", "debtor.debtorDNI"],
        ["operator", Operator.EQUAL],
        ["value", request.debtorDNI],
      ])
    )

    if (request.status) {
      filters.push(
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", request.status],
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
