import { BankStatementStatus, IBankStatementRepository } from "@/Banking/domain"
import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { DispatchUpdateStatusFinancialRecord } from "@/Financial/applications"
import { IQueueService } from "@/Shared/domain"
import { FinancialRecordStatus } from "@/Financial/domain"
import { LinkBankStatementRequest } from "@/Banking/domain/requests/LinkBankStatement.request"

export class LinkBankStatementToFinancialRecord {
  private readonly dispatcher: DispatchUpdateStatusFinancialRecord

  constructor(
    private readonly bankStatementRepository: IBankStatementRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    queueService: IQueueService
  ) {
    this.dispatcher = new DispatchUpdateStatusFinancialRecord(queueService)
  }

  async execute(request: LinkBankStatementRequest): Promise<void> {
    const statement = await this.bankStatementRepository.one({
      churchId: request.churchId,
      bankStatementId: request.bankStatementId,
    })

    if (!statement) {
      throw new Error("Bank statement not found")
    }

    const financialRecord = await this.financialRecordRepository.one({
      churchId: request.churchId,
      financialRecordId: request.financialRecordId,
    })

    if (!financialRecord) {
      throw new Error("Financial record not found")
    }

    if (
      statement.getReconciliationStatus() === BankStatementStatus.RECONCILED &&
      statement.getFinancialRecordId() === request.financialRecordId
    ) {
      return
    }

    statement.reconcile(request.financialRecordId)

    await this.bankStatementRepository.updateStatus(
      statement.getBankStatementId(),
      BankStatementStatus.RECONCILED,
      request.financialRecordId
    )

    this.dispatcher.execute({
      financialRecord: financialRecord.toPrimitives(),
      status: FinancialRecordStatus.RECONCILED,
    })
  }
}
