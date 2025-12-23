import {
  IMemberRepository,
  Member,
  MemberNotFound,
  UpdateMemberRequest,
} from "../../domain"
import { Logger } from "@/Shared/adapter"

export class UpdateMember {
  private logger = Logger(UpdateMember.name)

  constructor(private readonly memberRepository: IMemberRepository) {}

  async execute(request: UpdateMemberRequest): Promise<void> {
    if (!request.memberId) {
      throw new MemberNotFound()
    }

    const member: Member = await this.memberRepository.one({
      memberId: request.memberId,
    })

    if (!member) {
      throw new MemberNotFound()
    }

    if (typeof request.dni === "string") member.setDni(request.dni)
    if (typeof request.email === "string") member.setEmail(request.email)
    if (typeof request.phone === "string") member.setPhone(request.phone)
    if (typeof request.name === "string") member.setName(request.name)
    if (request.birthdate) member.setBirthdate(request.birthdate)
    if (request.baptismDate) member.setBaptismDate(request.baptismDate)
    if (request.conversionDate) member.setConversionDate(request.conversionDate)
    if (typeof request.isTreasurer === "boolean") {
      member.isTreasurer = request.isTreasurer
    }

    if (typeof request.active === "boolean") {
      if (request.active) member.enable()
      else member.disable()
    }

    if (request.settings) {
      member.setSettings(request.settings)
    }

    await this.memberRepository.upsert(member)

    this.logger.info(`Finished updating member ${request.memberId}`)
  }
}
