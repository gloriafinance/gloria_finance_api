import { Logger } from "@/Shared/adapter"
import {
  AccountReceivable,
  AccountReceivableType,
  AccountsReceivableStatus,
  type FilterMemberAccountReceivableRequest,
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

type Request = FilterMemberAccountReceivableRequest & { debtorDNI: string }

export class ListMemberAccountReceivable {
  private logger = Logger(ListMemberAccountReceivable.name)

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository
  ) {}

  async execute(request: Request): Promise<Paginate<AccountReceivable>> {
    this.logger.info(`Start List Member Account Receivable`, request)

    return this.accountReceivableRepository.list(this.prepareCriteria(request))
  }

  private prepareCriteria(request: Request) {
    const filters = []

    filters.push(
      new Map([
        ["field", "churchId"],
        ["operator", Operator.EQUAL],
        ["value", request.churchId],
      ])
    )

    if (request.type) {
      filters.push(
        new Map([
          ["field", "type"],
          ["operator", Operator.EQUAL],
          ["value", request.type],
        ])
      )
    } else {
      filters.push(
        new Map<string, any>([
          ["field", "type"],
          ["operator", Operator.IN],
          [
            "value",
            [AccountReceivableType.CONTRIBUTION, AccountReceivableType.LOAN],
          ],
        ])
      )
    }

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
    } else {
      filters.push(
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", AccountsReceivableStatus.PENDING],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("createdAt", OrderTypes.ASC),
      Number(request.perPage),
      Number(request.page)
    )
  }
}
