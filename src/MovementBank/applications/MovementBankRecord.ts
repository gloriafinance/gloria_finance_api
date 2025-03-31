import {
  IMovementBankRepository,
  MovementBank,
  MovementBankRequest,
} from "../domain"
import { IQueue } from "@/Shared/domain"
import { IFinancialConfigurationRepository } from "@/Financial/domain/interfaces"
import { Logger } from "@/Shared/adapter"

export class MovementBankRecord implements IQueue<void> {
  private logger = Logger("MovementBankRecord")

  constructor(
    private readonly movementBankRepository: IMovementBankRepository,
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository
  ) {}

  async handle(args: MovementBankRequest): Promise<void> {
    this.logger.info(`MovementBankRecord`, args)
    const bank = await this.financialConfigurationRepository.findBankByBankId(
      args.bankId
    )

    const movementBank = MovementBank.create(
      args.amount,
      args.bankingOperation,
      args.concept,
      bank
    )

    await this.movementBankRepository.upsert(movementBank)
  }
}
