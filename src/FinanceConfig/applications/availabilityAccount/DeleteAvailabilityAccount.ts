import { Logger } from "@/Shared/adapter"
import type {
  IAvailabilityAccountBankStatementChecker,
  IAvailabilityAccountFinancialMovementChecker,
  IAvailabilityAccountRepository,
} from "@/FinanceConfig/domain"
import { FindAvailabilityAccountByAvailabilityAccountId } from "./FindAvailabilityAccountByAvailabilityAccountId"
import { AvailabilityAccountHasMovements } from "@/FinanceConfig/domain"

export class DeleteAvailabilityAccount {
  private logger = Logger(DeleteAvailabilityAccount.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly financialMovementChecker: IAvailabilityAccountFinancialMovementChecker,
    private readonly bankStatementChecker: IAvailabilityAccountBankStatementChecker
  ) {}

  async execute(request: {
    availabilityAccountId: string
    churchId: string
  }): Promise<void> {
    this.logger.info(`Deleting availability account`, request)

    const availabilityAccount =
      await new FindAvailabilityAccountByAvailabilityAccountId(
        this.availabilityAccountRepository
      ).execute(request.availabilityAccountId, request.churchId)

    const hasFinancialMovements = await this.financialMovementChecker.exists(
      availabilityAccount.getAvailabilityAccountId(),
      request.churchId
    )

    if (hasFinancialMovements) {
      throw new AvailabilityAccountHasMovements(
        availabilityAccount.getAvailabilityAccountId()
      )
    }

    const hasBankStatements = await this.bankStatementChecker.exists(
      availabilityAccount.getAvailabilityAccountId(),
      request.churchId
    )

    if (hasBankStatements) {
      throw new AvailabilityAccountHasMovements(
        availabilityAccount.getAvailabilityAccountId()
      )
    }

    await this.availabilityAccountRepository.deleteByAvailabilityAccountId(
      availabilityAccount.getAvailabilityAccountId()
    )

    this.logger.info(`Availability account deleted`, request)
  }
}
