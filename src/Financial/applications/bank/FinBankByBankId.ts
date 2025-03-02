import { BankNotFound } from "../../domain"
import { IFinancialConfigurationRepository } from "../../domain/interfaces"

export class FinBankByBankId {
  constructor(
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository
  ) {}

  async execute(bankId: string) {
    const bank =
      await this.financialConfigurationRepository.findBankByBankId(bankId)

    if (!bank) throw new BankNotFound()

    return bank
  }
}
