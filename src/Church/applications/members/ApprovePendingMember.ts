import {
  type IMemberRepository,
  MemberNotFound,
  MemberNotPendingReview,
  MemberStatus,
} from "../../domain"
import { Logger } from "@/Shared/adapter"
import { type IQueueService, QueueName } from "@/package/queue/domain"

export class ApprovePendingMember {
  private logger = Logger(ApprovePendingMember.name)

  constructor(
    private readonly memberRepository: IMemberRepository,
    private readonly queueService: IQueueService
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

    member.approve()

    await this.memberRepository.upsert(member)

    this.queueService.dispatch(QueueName.CreateUserForMemberJob, member)
    this.logger.info(`Pending member approved: ${params.memberId}`)
  }
}
