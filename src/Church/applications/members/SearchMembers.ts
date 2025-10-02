import { IMemberRepository } from "../../domain"
import { MemberPaginateRequest } from "@/Church/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"

export class SearchMembers {
  constructor(private readonly memberRepository: IMemberRepository) {}

  async execute(request: MemberPaginateRequest) {
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
          ["field", "churchId"],
          ["operator", Operator.EQUAL],
          ["value", request.churchId],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("members.name", OrderTypes.DESC),
      request.perPage,
      request.page
    )
  }
}
