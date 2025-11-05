import { IBankStatementRepository, BankStatement } from "@/banking/domain"
import { ListBankStatementsRequest } from "@/banking/domain/requests/ListBankStatements.request"

export class ListBankStatements {
  constructor(private readonly repository: IBankStatementRepository) {}

  async execute(request: ListBankStatementsRequest): Promise<BankStatement[]> {
    return this.repository.list(request)
  }
}
