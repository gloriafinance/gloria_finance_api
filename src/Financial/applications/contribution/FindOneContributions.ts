import type { IOnlineContributionsRepository } from "@/Financial/domain/interfaces"
import { ContributionNotFound, OnlineContributions } from "@/Financial/domain"

export class FindOneContributions {
  constructor(
    private readonly contributionRepository: IOnlineContributionsRepository
  ) {}

  async execute(contributionId: string): Promise<OnlineContributions> {
    const contribution = await this.contributionRepository.one({
      contributionId,
    })

    if (!contribution) {
      throw new ContributionNotFound()
    }

    return contribution
  }
}
