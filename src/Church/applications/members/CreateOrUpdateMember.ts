import {
  Church,
  ChurchNotFound,
  IChurchRepository,
  IMemberRepository,
  Member,
  MemberExist,
  MemberRequest,
} from "../../domain"
import { IQueueService, QueueName } from "../../../Shared/domain"
import { Logger } from "../../../Shared/adapter"

export class CreateOrUpdateMember {
  private logger = Logger("CreateOrUpdateMember")

  constructor(
    private readonly memberRepository: IMemberRepository,
    private readonly churchRepository: IChurchRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(request: MemberRequest) {
    const member = await this.memberRepository.one(request.dni)
    if (!member) {
      await this.create(request)
      return
    }

    member.setDni(request.dni)
    member.setEmail(request.email)
    member.setPhone(request.phone)
    member.setName(request.name)
    member.setBirthdate(request.birthdate)
    member.setBaptismDate(request.baptismDate)
    member.setConversionDate(request.conversionDate)

    return await this.memberRepository.upsert(member)
  }

  private async getChurch(churchId: string): Promise<Church> {
    const church: Church = await this.churchRepository.one(churchId)

    if (!church) {
      throw new ChurchNotFound()
    }
    return church
  }

  private async create(request: MemberRequest) {
    this.logger.info(`Register member ${JSON.stringify(request)}`)

    const memberExist: Member = await this.memberRepository.one(request.dni)
    if (memberExist) {
      throw new MemberExist()
    }
    const church: Church = await this.getChurch(request.churchId)

    const member: Member = Member.create(
      request.name,
      request.phone,
      request.dni,
      church,
      request.birthdate,
      request.email,
      request.conversionDate,
      request.isTreasurer,
      false,
      request.baptismDate
    )

    await this.memberRepository.upsert(member)

    this.queueService.dispatch(QueueName.CreateUserForMember, member)
  }
}
