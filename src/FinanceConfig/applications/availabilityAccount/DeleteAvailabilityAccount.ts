import { Logger } from "@/Shared/adapter"
import type { IAvailabilityAccountRepository } from "@/FinanceConfig/domain"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces/FinancialRecordRepository.interface"
import type { IBankStatementRepository } from "@/Banking/domain/interfaces/BankStatementRepository.interface"
import { FindAvailabilityAccountByAvailabilityAccountId } from "@/FinanceConfig/applications"
import { AvailabilityAccountHasMovements } from "@/Financial/domain"

export class DeleteAvailabilityAccount {
  private logger = Logger(DeleteAvailabilityAccount.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly bankStatementRepository: IBankStatementRepository
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

    const financialMovement = await this.financialRecordRepository.one({
      churchId: request.churchId,
      "availabilityAccount.availabilityAccountId":
        availabilityAccount.getAvailabilityAccountId(),
    })

    if (financialMovement) {
      throw new AvailabilityAccountHasMovements(
        availabilityAccount.getAvailabilityAccountId()
      )
    }

    const bankStatement = await this.bankStatementRepository.one({
      churchId: request.churchId,
      "availabilityAccount.availabilityAccountId":
        availabilityAccount.getAvailabilityAccountId(),
    })

    if (bankStatement) {
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
