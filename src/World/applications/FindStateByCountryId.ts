import { States } from "../domain"
import type { IWorldRepository } from "../domain"

export class FindStateByCountryId {
  constructor(private readonly worldRepository: IWorldRepository) {}

  async run(countryId: string): Promise<States[]> {
    return await this.worldRepository.findByCountryId(countryId)
  }
}
