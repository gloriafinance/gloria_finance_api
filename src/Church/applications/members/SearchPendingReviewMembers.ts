import { type IMemberRepository, MemberStatus } from "../../domain"
import { type MemberPaginateRequest } from "@/Church/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"
import { Logger } from "@/Shared/adapter"

export class SearchPendingReviewMembers {
  private logger = Logger(SearchPendingReviewMembers.name)

  constructor(private readonly memberRepository: IMemberRepository) {}

  async execute(request: MemberPaginateRequest) {
    this.logger.info(`search pending review members with criteria:`, request)
    return await this.memberRepository.list(this.prepareCriteria(request))
  }

  private prepareCriteria(request: MemberPaginateRequest): Criteria {
    const filters: Map<string, string>[] = [
      new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", MemberStatus.PENDING_REVIEW],
      ]),
    ]

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
      Order.fromValues("createdAt", OrderTypes.DESC),
      Number(request.perPage),
      Number(request.page)
    )
  }
}
