import {
  type IMemberRepository,
  type Member,
  MemberNotFound,
} from "../../domain"

import { Logger } from "@/Shared/adapter"

export class FindMemberById {
  private logger = Logger(FindMemberById.name)

  constructor(private readonly memberRepository: IMemberRepository) {}

  async execute(params: {
    memberId?: string
    churchId?: string
  }): Promise<Member> {
    this.logger.info(`search member by id: ${params.memberId}`)

    if (!params.memberId || !params.churchId) {
      this.logger.error(`Member ID and church ID are required`)
      throw new MemberNotFound()
    }

    const member = await this.memberRepository.one({
      memberId: params.memberId,
      "church.churchId": params.churchId,
    })

    if (!member) {
      this.logger.error(`Member not found`)
      throw new MemberNotFound()
    }
    this.logger.info(`Member found: ${member.getName()}`)

    return member
  }
}
