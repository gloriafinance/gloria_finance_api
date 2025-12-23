import { IMemberRepository } from "../../domain"
import { MemberPaginateRequest } from "@/Church/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"
import { Logger } from "@/Shared/adapter"

export class SearchMembers {
  private logger = Logger(SearchMembers.name)

  constructor(private readonly memberRepository: IMemberRepository) {}

  async execute(request: MemberPaginateRequest) {
    this.logger.info(`search members with criteria:`, request)
    return await this.memberRepository.list(await this.prepareCriteria(request))
  }

  private async prepareCriteria(
    request: MemberPaginateRequest
  ): Promise<Criteria> {
    const filters = []

    if (request.regionId) {
      filters.push(
        new Map([
          ["field", "region.regionId"],
          ["operator", Operator.EQUAL],
          ["value", request.regionId],
        ])
      )
    }

    if (request.churchId) {
      filters.push(
        new Map([
          ["field", "church.churchId"],
          ["operator", Operator.EQUAL],
          ["value", request.churchId],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("members.name", OrderTypes.DESC),
      Number(request.perPage),
      Number(request.page)
    )
  }
}
