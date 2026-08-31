import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { FinanceRecord, FinanceRecordNotFound } from "@/Financial/domain"

export class FindOneFinanceRecord {
  constructor(private readonly repository: IFinancialRecordRepository) {}

  async execute(financialRecordId: string): Promise<FinanceRecord> {
    console.log(financialRecordId)
    const financeRecord = await this.repository.one({ financialRecordId })

    if (!financeRecord) {
      throw new FinanceRecordNotFound()
    }

    return financeRecord
  }
}
