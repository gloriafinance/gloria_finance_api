import { BankStatementStatus, IBankStatementRepository } from "@/Banking/domain"
import { BankStatementReconciler } from "@/Banking/applications/BankStatementReconciler"
import { RetryBankStatementRequest } from "@/Banking/domain/requests/RetryBankStatement.request"

export class RetryBankStatementReconciliation {
  constructor(
    private readonly repository: IBankStatementRepository,
    private readonly reconciler: BankStatementReconciler
  ) {}

  async execute(request: RetryBankStatementRequest): Promise<{
    matched: boolean
    financialRecordId?: string
  }> {
    const statement = await this.repository.one({
      churchId: request.churchId,
      bankStatementId: request.bankStatementId,
    })

    if (!statement) {
      throw new Error("Bank statement not found")
    }

    if (
      statement.getReconciliationStatus() === BankStatementStatus.RECONCILED
    ) {
      return {
        matched: true,
        financialRecordId: statement.getFinancialRecordId(),
      }
    }

    return this.reconciler.execute(statement)
  }
}
