import { Logger } from "@/Shared/adapter/CustomLogger"
import {
  BankStatement,
  BankStatementDirection,
  IBankStatementRepository,
} from "@/Banking/domain"
import {
  FinanceRecord,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"
import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { DispatchUpdateStatusFinancialRecord } from "@/Financial/applications"
import { IQueueService } from "@/Shared/domain"

const DIRECTION_TO_TYPES: Record<
  BankStatementDirection,
  FinancialRecordType[]
> = {
  [BankStatementDirection.INCOME]: [FinancialRecordType.INCOME],
  [BankStatementDirection.OUTGO]: [
    FinancialRecordType.OUTGO,
    FinancialRecordType.PURCHASE,
  ],
}

export class BankStatementReconciler {
  private readonly logger = Logger(BankStatementReconciler.name)
  private readonly dispatcher: DispatchUpdateStatusFinancialRecord

  constructor(
    private readonly bankStatementRepository: IBankStatementRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    queueService: IQueueService
  ) {
    this.dispatcher = new DispatchUpdateStatusFinancialRecord(queueService)
  }

  async execute(statement: BankStatement): Promise<{
    matched: boolean
    financialRecordId?: string
  }> {
    const match = await this.findMatchingFinancialRecord(statement)

    if (!match) {
      statement.markUnmatched()
      await this.bankStatementRepository.updateStatus(
        statement.getBankStatementId(),
        statement.getReconciliationStatus()
      )

      this.logger.info("Bank statement pending manual reconciliation", {
        bankStatementId: statement.getBankStatementId(),
        churchId: statement.getChurchId(),
      })

      return { matched: false }
    }

    statement.reconcile(match.getFinancialRecordId())

    await this.bankStatementRepository.updateStatus(
      statement.getBankStatementId(),
      statement.getReconciliationStatus(),
      match.getFinancialRecordId()
    )

    this.dispatcher.execute({
      financialRecord: { ...match.toPrimitives(), id: match.getId() },
      status: FinancialRecordStatus.RECONCILED,
    })

    this.logger.info("Bank statement reconciled", {
      bankStatementId: statement.getBankStatementId(),
      financialRecordId: match.getFinancialRecordId(),
    })

    return {
      matched: true,
      financialRecordId: match.getFinancialRecordId(),
    }
  }

  private async findMatchingFinancialRecord(
    statement: BankStatement
  ): Promise<FinanceRecord | undefined> {
    const postedAt = statement.getPostedAt()
    const directionTypes = DIRECTION_TO_TYPES[statement.getDirection()]
    const startDate = this.shiftDate(postedAt, -1)
    const endDate = this.shiftDate(postedAt, 1)

    const filters: Record<string, unknown> = {
      churchId: statement.getChurchId(),
      amount: statement.getAmount(),
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      type: { $in: directionTypes },
      status: {
        $in: [FinancialRecordStatus.PENDING, FinancialRecordStatus.CLEARED],
      },
      "availabilityAccount.availabilityAccountId":
        statement.getAvailabilityAccount().availabilityAccountId,
    }

    return await this.financialRecordRepository.one(filters)
  }

  private shiftDate(date: Date, days: number): Date {
    const newDate = new Date(date)
    newDate.setDate(date.getDate() + days)
    newDate.setHours(0, 0, 0, 0)
    return newDate
  }
}
