import { Bank } from "../../domain"
import { IFinancialConfigurationRepository } from "../../domain/interfaces"

export class SearchBankByChurchId {
  constructor(
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository
  ) {}

  async execute(churchId: string): Promise<Bank[]> {
    return this.financialConfigurationRepository.searchBanksByChurchId(churchId)
  }
}
