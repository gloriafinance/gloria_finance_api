import { FinanceRecord } from "../FinanceRecord"
import type { StatementCategorySummary } from "@/Financial/domain"
import type { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IFinancialRecordRepository extends IRepository<FinanceRecord> {
  deleteByFinancialRecordId(financialRecordId: string): Promise<void>
  findRecurringPayment(
    recurringPaymentId: string,
    competence: string
  ): Promise<FinanceRecord | undefined>

  /**
   * Includes voided records, so a re-execution after cancellation derives a new
   * identity instead of colliding with the previous one.
   */
  countRecurringPaymentRecords(
    recurringPaymentId: string,
    competence: string
  ): Promise<number>
  findByBankingExternalReference(
    reference: string
  ): Promise<FinanceRecord | undefined>
  listRecurringPaymentsForChurch(
    churchId: string,
    competence: string
  ): Promise<FinanceRecord[]>

  titheList(filter: object): Promise<{
    records: {
      amount: number
      date: Date
      availabilityAccountName: string
      availabilityAccountType: string
      symbol: string
    }[]
  }>

  fetchStatementCategories(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<StatementCategorySummary[]>
}
