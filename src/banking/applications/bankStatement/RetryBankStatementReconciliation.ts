import { BankStatementStatus, IBankStatementRepository } from "@/banking/domain"
import { BankStatementReconciler } from "@/banking/infrastructure/services/BankStatementReconciler"
import { RetryBankStatementRequest } from "@/banking/domain/requests/RetryBankStatement.request"

export class RetryBankStatementReconciliation {
  constructor(
    private readonly repository: IBankStatementRepository,
    private readonly reconciler: BankStatementReconciler
  ) {}

  async execute(request: RetryBankStatementRequest): Promise<{
    matched: boolean
    financialRecordId?: string
  }> {
    const statement = await this.repository.findById(
      request.churchId,
      request.bankStatementId
    )

    if (!statement) {
      throw new Error("Bank statement not found")
    }

    if (statement.getReconciliationStatus() === BankStatementStatus.RECONCILED) {
      return {
        matched: true,
        financialRecordId: statement.getFinancialRecordId(),
      }
    }

    return this.reconciler.reconcile(statement)
  }
}
