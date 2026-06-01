import { ChurchNotFound, type IChurchRepository } from "../../domain"

export type MemberRegistrationLinkDTO = {
  churchId: string
  churchName: string
  token: string
  registrationPath: string
}

export class GetOrCreateMemberRegistrationLink {
  constructor(private readonly churchRepository: IChurchRepository) {}

  async execute(churchId: string): Promise<MemberRegistrationLinkDTO> {
    const church = await this.churchRepository.findById(churchId)
    if (!church) {
      throw new ChurchNotFound()
    }

    const token =
      await this.churchRepository.getOrCreateMemberRegistrationToken(churchId)

    return {
      churchId: church.getChurchId(),
      churchName: church.getName(),
      token,
      registrationPath: `/member-registration/${token}`,
    }
  }
}
