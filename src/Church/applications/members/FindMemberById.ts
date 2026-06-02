import {
  type IMemberRepository,
  type Member,
  MemberNotFound,
} from "../../domain"

import { Logger } from "@/Shared/adapter"

export class FindMemberById {
  private logger = Logger(FindMemberById.name)

  constructor(private readonly memberRepository: IMemberRepository) {}

  async execute(
    params:
      | string
      | {
          memberId?: string
          churchId?: string
        }
  ): Promise<Member> {
    const memberId = typeof params === "string" ? params : params.memberId
    const churchId = typeof params === "string" ? undefined : params.churchId

    this.logger.info(`search member by id: ${memberId}`)

    if (!memberId) {
      this.logger.error(`Member ID is required`)
      throw new MemberNotFound()
    }

    const filter =
      churchId != null
        ? {
            memberId,
            "church.churchId": churchId,
          }
        : { memberId }

    const member = await this.memberRepository.one(filter)

    if (!member) {
      this.logger.error(`Member not found`)
      throw new MemberNotFound()
    }
    this.logger.info(`Member found: ${member.getName()}`)

    return member
  }
}
