import { ChurchNotFound } from "@/Church/domain/exceptions/ChurchNotFound.exception"
import type { IChurchRepository } from "@/Church/domain/interfaces/ChurchRepository.interface"
import type { ChurchBankingOnboardingDraft } from "@/Church/domain/type/ChurchBankingOnboarding.type"

export class SaveBankingOnboardingDraft {
  constructor(private readonly churchRepository: IChurchRepository) {}

  async execute(
    churchId: string,
    userId: string,
    draft: ChurchBankingOnboardingDraft
  ) {
    const church = await this.churchRepository.findById(churchId)
    if (!church) throw new ChurchNotFound()

    church.updateBankingOnboardingDraft(draft, userId)
    await this.churchRepository.upsert(church)

    return church.getBankingOnboardingDraft()
  }
}
