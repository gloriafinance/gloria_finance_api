import { ChurchNotFound } from "@/Church/domain/exceptions/ChurchNotFound.exception"
import type { IChurchRepository } from "@/Church/domain/interfaces/ChurchRepository.interface"

export class GetBankingOnboardingDraft {
  constructor(private readonly churchRepository: IChurchRepository) {}

  async execute(churchId: string) {
    const church = await this.churchRepository.findById(churchId)
    if (!church) throw new ChurchNotFound()

    return church.getBankingOnboardingDraft()
  }
}
