import type {
  CreateMemberRequest,
  IChurchRepository,
  IMemberRepository,
} from "../../domain"
import { Church, ChurchNotFound, Member, MemberExist } from "../../domain"
import { Logger } from "@/Shared/adapter"
import { type IQueueService, QueueName } from "@/package/queue/domain"

export class CreateMember {
  private logger = Logger(CreateMember.name)

  constructor(
    private readonly memberRepository: IMemberRepository,
    private readonly churchRepository: IChurchRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(request: CreateMemberRequest): Promise<void> {
    const exists = await this.memberRepository.one({ dni: request.dni })
    if (exists) {
      throw new MemberExist()
    }

    const church = await this.getChurch(request.churchId)

    const member: Member = Member.create({
      name: request.name,
      phone: request.phone,
      dni: request.dni,
      church,
      birthdate: request.birthdate,
      email: request.email,
      conversionDate: request.conversionDate,
      isTreasurer: request.isTreasurer,
      isMinister: false,
      baptismDate: request.baptismDate,
      settings: request.settings,
    })

    if (!request.active) {
      member.disable()
    }

    await this.memberRepository.upsert(member)

    this.queueService.dispatch(QueueName.CreateUserForMemberJob, member)

    this.logger.info(
      `Queue dispatched for create user for member ${JSON.stringify(member)}`
    )
  }

  private async getChurch(churchId: string): Promise<Church> {
    const church: Church | undefined =
      await this.churchRepository.findById(churchId)

    if (!church) {
      throw new ChurchNotFound()
    }
    return church
  }
}
