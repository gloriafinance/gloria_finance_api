import {
  type IMemberRepository,
  type Member,
  MemberNotFound,
  MemberNotPendingReview,
  MemberStatus,
} from "../../domain"

import { Logger } from "@/Shared/adapter"

export class FindPendingReviewMemberById {
  private logger = Logger(FindPendingReviewMemberById.name)

  constructor(private readonly memberRepository: IMemberRepository) {}

  async execute(params: {
    memberId?: string
    churchId?: string
  }): Promise<Member> {
    this.logger.info(`search pending review member by id: ${params.memberId}`)

    if (!params.memberId || !params.churchId) {
      this.logger.error(`Member ID and church ID are required`)
      throw new MemberNotFound()
    }

    const member = await this.memberRepository.one({
      memberId: params.memberId,
      "church.churchId": params.churchId,
    })

    if (!member) {
      this.logger.error(`Pending review member not found`)
      throw new MemberNotFound()
    }

    if (member.getStatus() !== MemberStatus.PENDING_REVIEW) {
      this.logger.error(`Member is not pending review`)
      throw new MemberNotPendingReview()
    }

    this.logger.info(`Pending review member found: ${member.getName()}`)

    return member
  }
}
