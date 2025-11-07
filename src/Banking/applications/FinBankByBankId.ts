import { Logger } from "@/Shared/adapter"
import { BankNotFound, IBankRepository } from "@/Banking/domain"

export class FinBankByBankId {
  private logger = Logger(FinBankByBankId.name)

  constructor(private readonly bankRepository: IBankRepository) {}

  async execute(bankId: string) {
    this.logger.info(`Finding bank by bankId: ${bankId}`)

    const bank = await this.bankRepository.one(bankId)

    if (!bank) {
      this.logger.error(`Bank not found: ${bankId}`)
      throw new BankNotFound()
    }

    this.logger.info(`Bank found: `, bank)
    return bank
  }
}
