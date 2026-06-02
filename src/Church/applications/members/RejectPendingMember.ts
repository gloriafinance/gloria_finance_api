import {
  type IMemberRepository,
  MemberNotFound,
  MemberNotPendingReview,
  MemberStatus,
} from "../../domain"
import { Logger } from "@/Shared/adapter"
import type { IStorageService } from "@/Shared/domain"

export class RejectPendingMember {
  private logger = Logger(RejectPendingMember.name)

  constructor(
    private readonly memberRepository: IMemberRepository,
    private readonly storage: IStorageService
  ) {}

  async execute(params: {
    memberId?: string
    churchId?: string
  }): Promise<void> {
    if (!params.memberId || !params.churchId) {
      throw new MemberNotFound()
    }

    const member = await this.memberRepository.one({
      memberId: params.memberId,
      "church.churchId": params.churchId,
    })

    if (!member) {
      throw new MemberNotFound()
    }

    if (member.getStatus() !== MemberStatus.PENDING_REVIEW) {
      throw new MemberNotPendingReview()
    }

    await this.memberRepository.deleteByMemberId(params.memberId)

    const profilePhoto = member.getProfilePhoto()
    if (profilePhoto) {
      await this.storage.deleteFile(profilePhoto).catch((error: any) => {
        this.logger.error("Unable to delete member profile photo", {
          memberId: params.memberId,
          error: error?.message,
        })
      })
    }

    this.logger.info(`Pending member rejected: ${params.memberId}`)
  }
}
