import {
  AccountReceivable,
  AccountReceivableRequest,
  IAccountsReceivableRepository,
} from "@/AccountsReceivable/domain"
import { Logger } from "@/Shared/adapter"

export class CreateAccountReceivable {
  private logger = Logger("CreateAccountReceivable")

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository
  ) {}

  async execute(
    requestAccountReceivable: AccountReceivableRequest
  ): Promise<void> {
    this.logger.info(
      `Start Create Account Receivable`,
      requestAccountReceivable
    )

    const account = AccountReceivable.create(requestAccountReceivable)

    await this.accountReceivableRepository.upsert(account)

    this.logger.info(`CreateAccountReceivable finish`)
  }
}
