import { Logger } from "@/Shared/adapter/CustomLogger"
import {
  BankStatement,
  BankStatementDirection,
  IBankStatementRepository,
} from "@/banking/domain"
import {
  FinancialRecordStatus,
  FinancialRecordType,
  FinanceRecord,
} from "@/Financial/domain"
import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { DispatchUpdateStatusFinancialRecord } from "@/Financial/applications"
import { IQueueService } from "@/Shared/domain"

const DIRECTION_TO_TYPES: Record<BankStatementDirection, FinancialRecordType[]> =
  {
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

  async reconcile(statement: BankStatement): Promise<{
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
      financialRecord: match.toPrimitives(),
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
    }

    const accountName = statement.getAccountName()
    if (accountName) {
      filters["availabilityAccount.accountName"] = new RegExp(accountName, "i")
    }

    const record = await this.financialRecordRepository.one(filters)
    return record
  }

  private shiftDate(date: Date, days: number): Date {
    const copy = new Date(date)
    copy.setUTCDate(copy.getUTCDate() + days)
    return copy
  }
}
