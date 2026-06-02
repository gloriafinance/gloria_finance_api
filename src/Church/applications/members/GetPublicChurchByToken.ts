import { type IChurchRepository, TokenNotFound } from "../../domain"

export type PublicChurchInfoDTO = {
  churchId: string
  churchName: string
}

export class GetPublicChurchByToken {
  constructor(private readonly churchRepository: IChurchRepository) {}

  async execute(token: string): Promise<PublicChurchInfoDTO> {
    const church = await this.churchRepository.one({
      "memberRegistration.token": token,
    })

    if (!church) {
      throw new TokenNotFound()
    }

    return {
      churchId: church.getChurchId(),
      churchName: church.getName(),
    }
  }
}
