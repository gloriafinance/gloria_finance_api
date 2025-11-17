import { IQueue } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import {
  IBankRepository,
  IMovementBankRepository,
  MovementBank,
  MovementBankRequest,
} from "@/Banking/domain"

export class MovementBankRecordJob implements IQueue {
  private logger = Logger("MovementBankRecord")

  constructor(
    private readonly movementBankRepository: IMovementBankRepository,
    private readonly bankRepository: IBankRepository
  ) {}

  async handle(args: MovementBankRequest): Promise<void> {
    this.logger.info(`MovementBankRecord`, args)
    const bank = await this.bankRepository.one(args.bankId)

    const movementBank = MovementBank.create(
      args.amount,
      args.bankingOperation,
      args.concept,
      bank,
      new Date(args.createdAt)
    )

    await this.movementBankRepository.upsert(movementBank)

    this.logger.info(`MovementBankRecord created`)
  }
}
